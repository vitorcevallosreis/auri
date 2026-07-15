# Configuração e Uso do MinIO para Armazenamento de Mídias

Este documento descreve a implementação do sistema de armazenamento de mídias utilizando o MinIO S3 para o aplicativo Myia.

## Visão Geral

O MinIO é um servidor de armazenamento de objetos compatível com Amazon S3, de alta performance e código aberto. Utilizamos o MinIO para armazenar diferentes tipos de mídia enviados através da aplicação, como:

- Áudios
- Imagens
- Documentos

## Estrutura de Buckets

A organização do armazenamento é feita através de buckets específicos para cada tipo de mídia:

- `audio` - Para arquivos de áudio (.mp3, .ogg, .wav, etc.)
- `imagens` - Para arquivos de imagem (.jpg, .png, .jpeg, etc.)
- `arquivos` - Para documentos e outros tipos de arquivo (.pdf, .docx, .xlsx, etc.)

## Configuração do MinIO

### Variáveis de Ambiente

Para configurar a conexão com o MinIO, as seguintes variáveis de ambiente devem estar definidas:

```
NEXT_PUBLIC_MINIO_SERVER_URL=https://seu-servidor-minio.com
NEXT_PUBLIC_MINIO_ACCESS_KEY=seu-access-key
NEXT_PUBLIC_MINIO_SECRET_KEY=seu-secret-key
NEXT_PUBLIC_MINIO_PORT=9000 (opcional, porta padrão é 9000)
NEXT_PUBLIC_MINIO_USE_SSL=true (opcional, padrão é true)
```

## Fluxo de Processamento de Mídia

### 1. Envio de Mensagem com Mídia

O fluxo para envio de mídia segue estes passos:

1. O usuário seleciona um arquivo (imagem, áudio ou documento) para enviar
2. A aplicação identifica o tipo de mídia e chama a função apropriada:
   - `send_image_message` - Para imagens
   - `send_audio_message` - Para áudios
   - `send_document_message` - Para documentos

### 2. Upload para MinIO

1. A aplicação envia o arquivo para a API local apropriada:
   - `/api/upload/media` - Para imagens e documentos
   - `/api/upload/audio` - Para arquivos de áudio

2. A API realiza:
   - Validação do arquivo (tipo, tamanho)
   - Upload para o bucket apropriado no MinIO
   - Retorna a URL pública do arquivo

### 3. Envio da Mensagem

1. A URL do arquivo no MinIO é utilizada para criar a mensagem no banco de dados
2. A mensagem é enviada para a API do WhatsApp (Evolution API)
3. O status da mensagem é atualizado no banco de dados

## Serviços Implementados

### MinioService

O serviço `MinioService` fornece métodos para:

- `uploadImage(imageFile: File)`: Upload de imagens para o bucket `imagens`
- `uploadDocument(documentFile: File)`: Upload de documentos para o bucket `arquivos`
- `uploadAudio(audioFile: File)`: Upload de áudios para o bucket `audio`
- `fallbackToBase64(file: File)`: Converte arquivos para base64 como fallback
- `checkConnection()`: Verifica a conexão com o servidor MinIO

### MessageService

O serviço `MessageService` utiliza o `MinioService` e implementa:

- `sendImageMessage()`: Envia imagens através da Evolution API
- `sendDocumentMessage()`: Envia documentos através da Evolution API
- `sendAudioMessage()`: Envia áudios através da Evolution API
- `updateMediaUrl()`: Atualiza a URL da mídia no banco de dados

## Fallback para Base64

Para garantir a resiliência do sistema, implementamos um mecanismo de fallback para codificação base64 quando:

1. O upload para o MinIO falha
2. A conexão com o MinIO está indisponível
3. As credenciais do MinIO são inválidas

## Limitações

- Tamanho máximo de arquivo: 50MB
- Tipos de arquivo suportados:
  - Imagens: .jpg, .jpeg, .png, .gif
  - Áudio: .mp3, .ogg, .wav
  - Documentos: .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt, .zip

## Testes e Depuração

Um endpoint de teste foi criado em `/test-minio` para verificar a conexão com o MinIO e testar o upload de arquivos. Este endpoint permite:

1. Verificar se a conexão com o MinIO está funcionando
2. Testar o upload de arquivos para os diferentes buckets
3. Verificar as URLs geradas para os arquivos

## Integração com Sistema de Mensagens

O sistema de armazenamento de mídia está totalmente integrado com o sistema de mensagens do Myia, permitindo:

1. Upload de mídia diretamente nas conversas
2. Visualização de mídia enviada e recebida
3. Download de arquivos compartilhados

## Melhorias Futuras

- Implementação de cache local para arquivos acessados frequentemente
- Compressão automática de imagens grandes
- Geração de thumbnails para imagens e documentos
- Sistema de cotas por usuário
- Expiração automática de arquivos antigos
