# RUNBOOK — Deploy do Evolution API v2.3.7 self-hosted num VPS

> **Público:** dono do produto executando no VPS **do zero**.
> **Objetivo:** subir o gateway/ingress de WhatsApp (Evolution API v2.3.7 + Postgres 15 + Redis 7) atrás de nginx+TLS, com webhook apontando para o app Next.js.
> **Regra:** siga os passos **em ordem**. Cada bloco é copiável. Onde houver `<GERAR>`, `SEUDOMINIO`, `SEU_IP` etc., **substitua** antes de rodar.
>
> Base técnica: pesquisa do Evolution API v2 (sessão de 2026-07-15). Versão-alvo pinada: **`evoapicloud/evolution-api:v2.3.7`**.
> Lado do app já implementado: a rota de ingress `POST /api/whatsapp/ingress` (valida `X-Auri-Webhook-Secret`)
> e as envs `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_WEBHOOK_SECRET` — ver `docs/superpowers/plans/2026-07-15-plano2-evolution-ingress.md`.

**Convenções deste runbook**
- `wa.SEUDOMINIO.com.br` → subdomínio do **Evolution** (este VPS).
- `app.SEUDOMINIO.com.br` → onde roda o **app Next.js** (o ingress `/api/whatsapp/ingress`). Não é este VPS.
- Comandos com `sudo` assumem que você já está no usuário não-root criado no Passo 2.

---

## 1. Pré-requisitos

### 1.1 VPS (Ubuntu 22.04+ LTS)

Escolha **uma** opção:

| Opção | Specs | Custo aprox. | Quando escolher |
|---|---|---|---|
| **Contabo — Cloud VPS (São Paulo 🇧🇷)** | ~4 vCPU / **8 GB** / 75 GB SSD | **~US$7/mês** | **Recomendado se LGPD / residência de dados no Brasil importa.** Datacenter em SP → menor latência p/ contatos BR e dado no país. IO/suporte mais irregulares, mas ok. |
| **Hetzner — CX22** | 2 vCPU / **4 GB** / 40 GB NVMe | **~US$5/mês** | **Mais barato e mais estável**, mas datacenter na Europa (sem região BR). Latência p/ BR ~150ms (aceitável p/ WhatsApp). Transferência internacional de dados pessoais → tratar base legal LGPD (art. 33). |

> **Trade-off em uma linha:** Contabo SP = compliance/latência-BR mais simples, hardware mais irregular. Hetzner = melhor hardware/estabilidade e mais barato, porém dado fora do Brasil.
> **Não** use planos de 1 GB — Baileys + Postgres + Redis estouram. Mínimo real: **4 GB**.

Ao provisionar, escolha **Ubuntu 22.04 LTS** (ou 24.04). Anote o **IP público** (`SEU_IP`) e a senha/chave root inicial.

### 1.2 Domínio / DNS

No seu provedor de DNS, crie um **A record**:

```
Tipo: A
Nome: wa            (resulta em wa.SEUDOMINIO.com.br)
Valor: SEU_IP       (IP público do VPS)
TTL: 300
```

Verifique a propagação (do seu computador):
```bash
dig +short wa.SEUDOMINIO.com.br
# deve retornar SEU_IP
```
> Espere o DNS resolver **antes** de rodar o certbot (Passo 6), senão a emissão do certificado falha.

### 1.3 Acesso SSH

Do seu computador:
```bash
ssh root@SEU_IP
```
> Ideal: adicione sua chave pública SSH ao VPS (muitos provedores permitem no painel). Vamos desabilitar login root/senha logo abaixo.

---

## 2. Hardening inicial do VPS

Conectado como `root` (primeira vez):

### 2.1 Atualizar o sistema

```bash
apt update && apt upgrade -y
```

### 2.2 Criar usuário não-root com sudo

```bash
adduser deploy                 # defina uma senha forte quando pedir
usermod -aG sudo deploy
```

Copie sua chave SSH para o novo usuário (se você usa chave):
```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

### 2.3 Endurecer o SSH

```bash
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config   # só se usa chave SSH!
sudo systemctl restart ssh
```
> ⚠️ Só desative `PasswordAuthentication` se você **confirmou** que consegue logar por chave. Abra uma **segunda** sessão SSH como `deploy` para testar **antes** de fechar a atual.

Daqui em diante, **logue como `deploy`**:
```bash
ssh deploy@SEU_IP
```

### 2.4 Firewall (ufw) — permitir só 22/80/443

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (certbot + redirect)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
sudo ufw status verbose
```
> As portas `8080` (Evolution), `5432` (Postgres) e `6379` (Redis) **NÃO** são abertas — ficam só na rede interna do Docker / loopback.

### 2.5 fail2ban (opcional, recomendado)

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo systemctl status fail2ban --no-pager
```
> Config padrão já protege o SSH. Suficiente para o Plano 2.

### 2.6 Instalar Docker + Docker Compose plugin

```bash
# Dependências
sudo apt install -y ca-certificates curl gnupg

# Chave GPG oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Repositório
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar engine + compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Rodar docker sem sudo
sudo usermod -aG docker deploy
newgrp docker    # aplica o grupo na sessão atual (ou faça logout/login)

# Verificar
docker --version
docker compose version
```
> Se `docker compose version` falhar, o plugin não instalou — reveja o passo. Use **`docker compose`** (com espaço), não o antigo `docker-compose`.

---

## 3. `docker-compose.yml` final

Crie o diretório do projeto e o arquivo:

```bash
mkdir -p ~/evolution && cd ~/evolution
nano docker-compose.yml
```

Cole **exatamente** (portas ligadas só ao loopback — nginx faz o TLS na frente):

```yaml
services:
  evolution-api:
    container_name: evolution_api
    image: evoapicloud/evolution-api:v2.3.7   # versão PINADA — não usar :latest
    restart: always
    depends_on:
      - postgres
      - redis
    ports:
      - "127.0.0.1:8080:8080"                 # acessível só localmente; nginx faz proxy
    volumes:
      - evolution_instances:/evolution/instances
    env_file:
      - .env
    networks:
      - evolution-net

  postgres:
    container_name: evolution_postgres
    image: postgres:15
    restart: always
    command: postgres -c max_connections=1000 -c listen_addresses=*
    environment:
      - POSTGRES_DB=evolution
      - POSTGRES_USER=evolution
      - POSTGRES_PASSWORD=<GERAR_SENHA_POSTGRES>   # mesma senha do .env (DATABASE_CONNECTION_URI)
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - evolution-net
    expose:
      - "5432"

  redis:
    container_name: evolution_redis
    image: redis:7
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - evolution_redis:/data
    networks:
      - evolution-net
    expose:
      - "6379"

volumes:
  evolution_instances:
  postgres_data:
  evolution_redis:

networks:
  evolution-net:
    driver: bridge
```

Salve (`Ctrl+O`, `Enter`, `Ctrl+X`).

> A senha em `POSTGRES_PASSWORD` **precisa ser idêntica** à que vai no `DATABASE_CONNECTION_URI` do `.env` (Passo 4).

---

## 4. `.env` de produção

Gere primeiro os segredos:

```bash
# API key global do Evolution (admin) — GUARDE em local seguro
openssl rand -hex 32
# Senha do Postgres
openssl rand -hex 24
# Secret compartilhado do webhook (= EVOLUTION_WEBHOOK_SECRET no app Next)
openssl rand -hex 32
```

Crie o `.env` no mesmo diretório:

```bash
nano ~/evolution/.env
```

Cole e **substitua os `<GERAR...>`** pelos valores acima:

```dotenv
# ---------- Servidor / core ----------
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=https://wa.SEUDOMINIO.com.br
LANGUAGE=pt-BR
TELEMETRY_ENABLED=false
DEL_INSTANCE=false

# ---------- Autenticação (CRÍTICO) ----------
AUTHENTICATION_API_KEY=<GERAR_openssl_rand_hex_32>
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true

# ---------- Banco (obrigatório na v2) ----------
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:<GERAR_SENHA_POSTGRES>@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=evolution_exchange
# Minimização de dados (LGPD): NÃO persistir conteúdo de mensagens no Evolution.
# O Supabase é a fonte de verdade. O conteúdo vai só para o seu webhook.
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false

# ---------- Cache (Redis) ----------
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_TTL=604800
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false

# ---------- Webhook global (deixamos OFF; setamos por-instância) ----------
WEBHOOK_GLOBAL_ENABLED=false
WEBHOOK_GLOBAL_URL=''
WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
WEBHOOK_REQUEST_TIMEOUT_MS=60000

# ---------- Sessão / QR ----------
CONFIG_SESSION_PHONE_CLIENT=Auri
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30
QRCODE_COLOR='#175197'

# ---------- CORS ----------
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true
```

Salve. Proteja o arquivo:
```bash
chmod 600 ~/evolution/.env
```

> **Guarde numa senha-manager:** `AUTHENTICATION_API_KEY`, a senha do Postgres e o webhook secret. O `AUTHENTICATION_API_KEY` é o superusuário do gateway — nunca vá para o browser/git.

---

## 5. Subir os containers

```bash
cd ~/evolution
docker compose pull
docker compose up -d
```

Acompanhe os logs (as **migrations do Prisma** rodam no start contra o Postgres):

```bash
docker compose logs -f evolution-api
```
Procure por linhas de migration aplicada e o servidor ouvindo na porta 8080. Saia com `Ctrl+C` (não derruba os containers).

**Smoke test interno** (de dentro do VPS):
```bash
curl -s http://127.0.0.1:8080/ | head -c 300 ; echo
```
Deve retornar um JSON com `version`, `message`, etc. Se retornar, a API está de pé.

Cheque os containers:
```bash
docker compose ps
```
Todos devem estar `Up`. Se `evolution_api` reiniciar em loop → ver **Troubleshooting §9**.

---

## 6. nginx reverse proxy + TLS (Let's Encrypt)

### 6.1 Instalar nginx + certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 6.2 Server block

```bash
sudo nano /etc/nginx/sites-available/wa.SEUDOMINIO.com.br
```

Cole (config **HTTP** inicial — o certbot injeta o TLS depois):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name wa.SEUDOMINIO.com.br;

    client_max_body_size 50m;          # uploads de mídia (imagens/vídeos/docs)

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;   # websocket
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 120s;
    }
}
```

Ative e teste:
```bash
sudo ln -s /etc/nginx/sites-available/wa.SEUDOMINIO.com.br /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default        # remove o site default
sudo nginx -t                                      # deve dizer "syntax is ok / test is successful"
sudo systemctl reload nginx
```

### 6.3 Emitir o certificado TLS

> Confirme que `dig +short wa.SEUDOMINIO.com.br` retorna `SEU_IP` antes de rodar.

```bash
sudo certbot --nginx -d wa.SEUDOMINIO.com.br --redirect --agree-tos -m voce@SEUDOMINIO.com.br --no-eff-email
```
- `--redirect` cria automaticamente o **redirect 80 → 443**.
- O certbot reescreve o server block adicionando `listen 443 ssl`, os caminhos do certificado e o bloco de redirect.

Teste a renovação automática (o certbot instala um timer systemd):
```bash
sudo certbot renew --dry-run
```

**Validação externa** (do seu computador):
```bash
curl -s https://wa.SEUDOMINIO.com.br/ | head -c 300 ; echo
```
Deve retornar o mesmo JSON do smoke test, agora via HTTPS público.

---

## 7. Registrar instância + webhook

O webhook do Evolution vai **POSTar cada evento** para o ingress do seu app:
`https://app.SEUDOMINIO.com.br/api/whatsapp/ingress`

Para autenticar esses POSTs (o Evolution **não assina HMAC**), enviamos um header secreto **`X-Auri-Webhook-Secret`**. Esse valor é **exatamente** o `EVOLUTION_WEBHOOK_SECRET` configurado no app Next.js — o handler `/api/whatsapp/ingress` deve **rejeitar (401)** qualquer request cujo header não bata.

> Defina a variável no seu ambiente (facilita os curls). Use o **AUTHENTICATION_API_KEY** que você gerou no Passo 4:
```bash
export EVO_URL="https://wa.SEUDOMINIO.com.br"
export EVO_KEY="<AUTHENTICATION_API_KEY>"
export WEBHOOK_SECRET="<o mesmo EVOLUTION_WEBHOOK_SECRET do app Next>"
```

### 7.1 Criar a instância do tenant COM o webhook embutido

```bash
curl -s -X POST "$EVO_URL/instance/create" \
  -H "apikey: $EVO_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "auri_t_demo",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true,
    "webhook": {
      "url": "https://app.SEUDOMINIO.com.br/api/whatsapp/ingress",
      "byEvents": false,
      "base64": false,
      "headers": {
        "X-Auri-Webhook-Secret": "'"$WEBHOOK_SECRET"'"
      },
      "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE"]
    }
  }' | tee /tmp/instance-create.json ; echo
```

A resposta traz o **token da instância** (`hash`) e o primeiro QR:
```json
{
  "instance": { "instanceName": "auri_t_demo", "status": "created" },
  "hash": "B6D711FCDE4D4FD5936544120E713976",
  "qrcode": { "base64": "data:image/png;base64,iVBORw0KG..." }
}
```
> **Guarde o `hash`** no Supabase junto ao tenant. `instanceName` deve ser único e determinístico (ex: `auri_t_{tenantId}`).

### 7.2 (Alternativa) Setar/atualizar o webhook depois da criação

⚠️ Na v2 o corpo **precisa vir envelopado em `{"webhook": {...}}`** (ver §9):
```bash
curl -s -X POST "$EVO_URL/webhook/set/auri_t_demo" \
  -H "apikey: $EVO_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://app.SEUDOMINIO.com.br/api/whatsapp/ingress",
      "webhookByEvents": false,
      "base64": false,
      "headers": { "X-Auri-Webhook-Secret": "'"$WEBHOOK_SECRET"'" },
      "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE"]
    }
  }' ; echo
```
Confirmar o que ficou setado:
```bash
curl -s "$EVO_URL/webhook/find/auri_t_demo" -H "apikey: $EVO_KEY" | python3 -m json.tool
```

### 7.3 Pegar o QR (base64) para parear

Se você não guardou o QR do create, renove:
```bash
curl -s "$EVO_URL/instance/connect/auri_t_demo" -H "apikey: $EVO_KEY" | python3 -m json.tool
```
Retorna `{ "base64": "data:image/png;base64,...", "code": "...", "pairingCode": "...." }`.

Para **visualizar o QR** rapidamente, extraia o base64 e abra num navegador (no seu computador):
```bash
# no seu computador, cole o valor de "base64" (sem o prefixo data:...) e:
# echo 'iVBORw0KG...' | base64 -d > qr.png && open qr.png
```
Ou simplesmente renderize o `base64` num `<img src="data:image/png;base64,...">` no dashboard. Abra o WhatsApp no celular do tenant → **Aparelhos conectados → Conectar um aparelho** → escaneie. (Alternativa: use o `pairingCode` de 8 dígitos em "Conectar com número".)

### 7.4 Checar o estado da conexão

```bash
curl -s "$EVO_URL/instance/connectionState/auri_t_demo" -H "apikey: $EVO_KEY" ; echo
```
Retorna `{"instance":{"state":"open"}}` quando pareado. Estados: `connecting` → `open` (conectado) → `close` (caiu/deslogado). O evento `connection.update` também chega no seu webhook em tempo real.

### 7.5 Teste de envio (opcional, confirma ponta-a-ponta)

```bash
curl -s -X POST "$EVO_URL/message/sendText/auri_t_demo" \
  -H "apikey: $EVO_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "number": "5511999999999", "text": "Teste Auri ✅" }' ; echo
```
(Use um número real com DDI 55, sem `+`.)

---

## 8. Backups

**O que fazer backup:**
- `postgres_data` → banco (instâncias, config, webhooks).
- **`evolution_instances`** → **as sessões WhatsApp (credenciais Baileys) vivem aqui.** Perder = **todos os tenants precisam re-parear (novo QR).** É o volume mais crítico.

### 8.1 Script de backup

```bash
sudo mkdir -p /opt/backups && sudo chown deploy:deploy /opt/backups
nano ~/evolution/backup.sh
```

Cole:
```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
DEST=/opt/backups
cd ~/evolution

# 1) Dump lógico do Postgres
docker compose exec -T postgres pg_dump -U evolution evolution | gzip > "$DEST/pg-$STAMP.sql.gz"

# 2) Volume das sessões WhatsApp (tar do conteúdo do volume)
docker run --rm \
  -v evolution_evolution_instances:/data:ro \
  -v "$DEST":/backup \
  alpine tar czf "/backup/instances-$STAMP.tar.gz" -C /data .

# 3) Retenção: manter últimos 14 dias
find "$DEST" -type f -mtime +14 -delete
echo "backup ok: $STAMP"
```
> ⚠️ O nome real do volume tem o **prefixo do projeto** (nome do diretório). Confirme com `docker volume ls | grep instances` e ajuste `evolution_evolution_instances` se necessário (geralmente `<pasta>_evolution_instances`).

Torne executável e teste:
```bash
chmod +x ~/evolution/backup.sh
~/evolution/backup.sh
ls -lh /opt/backups
```

### 8.2 Cron diário (03:00)

```bash
crontab -e
```
Adicione:
```
0 3 * * * /home/deploy/evolution/backup.sh >> /home/deploy/evolution/backup.log 2>&1
```
> Recomendado: copiar `/opt/backups` para armazenamento externo (S3/Backblaze/rsync p/ outra máquina). Backup no mesmo VPS não protege contra perda do VPS. Criptografe os backups (contêm dados pessoais → LGPD).

### 8.3 Restore (referência)

```bash
# Postgres:
gunzip -c /opt/backups/pg-STAMP.sql.gz | docker compose exec -T postgres psql -U evolution -d evolution
# Sessões: parar a API, extrair o tar por cima do volume, subir de novo.
```

---

## 9. Troubleshooting

### 9.1 Container `evolution_api` reiniciando em loop
Quase sempre é o **banco**. Verifique:
```bash
docker compose logs evolution-api | tail -50
```
- `DATABASE_CONNECTION_URI` errado (usuário/senha/host). O host deve ser **`postgres`** (nome do serviço), não `localhost`. A senha deve **bater** com `POSTGRES_PASSWORD` do compose.
- Postgres ainda subindo → aguarde; o `depends_on` não espera "healthy". Se persistir, `docker compose restart evolution-api`.
- Confirme que o Postgres está de pé: `docker compose exec postgres pg_isready -U evolution`.

### 9.2 Webhook "não fica setado" / não chega no app
- **Causa nº1 na v2:** o corpo do `POST /webhook/set` **precisa vir envelopado** em `{"webhook": {...}}` (ver §7.2). Sem o envelope, o Evolution ignora silenciosamente.
- Confirme com `GET /webhook/find/{instance}`.
- Verifique se a `url` é pública/HTTPS e responde **200 rápido**. Timeout controlado por `WEBHOOK_REQUEST_TIMEOUT_MS`.
- Header não bate → seu app retorna 401 e você "não vê" a mensagem. Confira que `X-Auri-Webhook-Secret` == `EVOLUTION_WEBHOOK_SECRET` do Next.
- Lembre: eventos configuram em UPPERCASE (`MESSAGES_UPSERT`) mas chegam no payload em lowercase (`messages.upsert`).

### 9.3 QR expira antes de escanear
- O QR tem vida curta e é regenerado até **`QRCODE_LIMIT`** vezes (default `30`). Se expirar, chame de novo `GET /instance/connect/{instance}` para obter um QR fresco, ou escute o evento `qrcode.updated` no webhook e re-renderize.
- Se estourar o limite de tentativas, a instância pode ir para `close` → faça `PUT /instance/restart/{instance}` e reconecte.

### 9.4 Outros checks rápidos
```bash
docker compose ps                          # todos Up?
docker compose logs -f evolution-api       # erros em tempo real
sudo nginx -t && sudo systemctl reload nginx
curl -s http://127.0.0.1:8080/ | head -c 200   # API viva localmente?
docker stats --no-stream                   # RAM/CPU (Baileys come memória por instância)
```

---

## 10. Checklist final de segurança

- [ ] `AUTHENTICATION_API_KEY` **trocado do default** (`openssl rand -hex 32`), guardado em senha-manager, **nunca** no browser/git.
- [ ] `.env` com `chmod 600`; segredos fora do git.
- [ ] Portas `8080`/`5432`/`6379` **não** expostas — só `127.0.0.1` / rede interna do Docker.
- [ ] ufw ativo permitindo **só 22/80/443**; verificado com `ufw status`.
- [ ] SSH: root login **off**, senha off (se usa chave), fail2ban ativo.
- [ ] nginx com **TLS válido** (certbot) e **redirect 80→443**; `certbot renew --dry-run` ok.
- [ ] `client_max_body_size 50m` no nginx (mídia).
- [ ] Webhook autenticado por **`X-Auri-Webhook-Secret`** (== `EVOLUTION_WEBHOOK_SECRET` do app); app retorna 401 se não bater.
- [ ] `TELEMETRY_ENABLED=false`.
- [ ] `DATABASE_SAVE_DATA_NEW_MESSAGE=false` (minimização LGPD; Supabase é a fonte de verdade).
- [ ] Backups diários de **`postgres_data`** e **`evolution_instances`**, copiados para fora do VPS e **criptografados**.
- [ ] Imagem **pinada** em `v2.3.7` (nunca `:latest`); atualizações lidas no CHANGELOG antes de subir.
- [ ] `hash` (token) de cada instância guardado no Supabase junto ao `tenant_id`.

---

### Referências
- Pesquisa base: `./agent2-evolution-research.md`
- Docs v2: https://doc.evolution-api.com/v2/en/install/docker · https://doc.evolution-api.com/v2/en/configuration/webhooks
- Repo (migrado): https://github.com/evolution-foundation/evolution-api · `.env.example` oficial
- Release estável: `v2.3.7` (2025-12-05)
