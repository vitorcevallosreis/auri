-- Assinatura eletrônica simples do prontuário.
--
-- 0020 deixou o médico em SOMENTE LEITURA e a tela desabilitou "Marcar como
-- revisado" e "Assinar". Esta migration liga as duas ações — e só elas.
--
-- POR QUE UMA RPC, E NÃO UMA POLICY DE UPDATE.
--
-- Uma `policy ... for update` autoriza a LINHA, nunca a COLUNA. Com ela o
-- médico passaria a poder reescrever anamnese, hipótese e conduta pelo cliente,
-- direto no PostgREST — e sem deixar rastro de que o texto mudou depois de
-- assinado, que é exatamente o que uma assinatura deveria impedir.
--
-- Grant por coluna também não resolve: grants são por ROLE do Postgres, e dono
-- e médico são os dois `authenticated`. Restringir colunas para um restringiria
-- para o outro.
--
-- Sobra a função `security definer` com a lista de colunas escrita à mão. Ela é
-- a única porta de escrita do médico nesta tabela, e o que ela não menciona,
-- ele não altera.

-- --------------------------------------------------------------------------
-- Transições permitidas
--
--   pending  → reviewed   marca revisado
--   pending  → signed     assina direto (assinar pressupõe ter revisado, então
--                         `reviewed_at` é preenchido junto se estiver vazio)
--   reviewed → signed     assina o que já havia revisado
--
-- `signed` é TERMINAL. Não há caminho de volta: um prontuário assinado que
-- pudesse voltar a rascunho não valeria como assinatura. Desassinar, se um dia
-- for preciso, é operação de auditoria — com registro de quem e por quê — e não
-- um botão na tela do médico.
-- --------------------------------------------------------------------------

create or replace function sign_medical_record(
  p_record_id uuid,
  p_action    text  -- 'review' | 'sign'
)
returns myia_medical_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof   uuid := auth_professional_id();
  v_role   text := app_role();
  v_status text;
  v_row    myia_medical_records;
begin
  if p_action not in ('review', 'sign') then
    raise exception 'Ação inválida: %', p_action using errcode = '22023';
  end if;

  if v_role is distinct from 'professional' or v_prof is null then
    raise exception 'Somente o profissional responsável assina o prontuário'
      using errcode = '42501';
  end if;

  -- `for update` trava a linha até o fim da transação: sem isso, dois cliques
  -- simultâneos leriam ambos 'pending' e o segundo sobrescreveria o carimbo de
  -- horário do primeiro.
  --
  -- O filtro por professional_id é o que faz o id de outro médico devolver
  -- "não encontrado" em vez de assinar o prontuário alheio. A função é
  -- `security definer`, então o RLS NÃO está valendo aqui dentro — este
  -- predicado é a única fronteira, e é por isso que ele está explícito.
  select review_status into v_status
    from myia_medical_records
   where id = p_record_id
     and professional_id = v_prof
     and company_id = auth_company_id()
   for update;

  if not found then
    raise exception 'Prontuário não encontrado' using errcode = 'P0002';
  end if;

  if v_status = 'signed' then
    raise exception 'Prontuário já assinado' using errcode = '23514';
  end if;

  if p_action = 'review' and v_status <> 'pending' then
    raise exception 'Prontuário já revisado' using errcode = '23514';
  end if;

  update myia_medical_records
     set review_status = case when p_action = 'sign' then 'signed' else 'reviewed' end,
         reviewed_at   = coalesce(reviewed_at, now()),
         signed_at     = case when p_action = 'sign' then now() else signed_at end,
         updated_at    = now()
   where id = p_record_id
  returning * into v_row;

  return v_row;
end;
$$;

-- `anon` fica de fora: sem sessão, `auth_professional_id()` é NULL e a função
-- já barraria — mas não conceder é mais barato que confiar no barramento.
grant execute on function sign_medical_record(uuid, text) to authenticated, service_role;

-- --------------------------------------------------------------------------
-- A policy de leitura de 0020 continua sendo a única do médico sobre a tabela.
-- Nenhum `for update` é adicionado aqui, DE PROPÓSITO: se um dia alguém criar
-- uma, o comentário abaixo é o aviso de que isso reabre a escrita do texto
-- clínico pelo cliente.
-- --------------------------------------------------------------------------
comment on function sign_medical_record(uuid, text) is
  'Única porta de escrita do profissional em myia_medical_records: altera '
  'apenas review_status/reviewed_at/signed_at. Não criar policy de UPDATE '
  'para o papel professional — isso liberaria a edição do texto clínico.';
