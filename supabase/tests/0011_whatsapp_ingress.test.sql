-- P2.1 — Prova da migration 0011 (índices do ingress de WhatsApp).
-- Convenção do runner (scripts/db-test.mjs): PASS = nenhum statement retorna linha;
-- roda tudo em UMA transação com rollback (self-contained, não depende do seed).

-- (1) O índice de lookup do canal por instância deve existir.
select 'faltando idx_channels_instancewpp'
from (select 1) x
where not exists (
  select 1 from pg_indexes
  where schemaname = 'public' and indexname = 'idx_channels_instancewpp'
);

-- (2) O índice único parcial de idempotência deve existir.
select 'faltando uq_messages_instance_msgid'
from (select 1) x
where not exists (
  select 1 from pg_indexes
  where schemaname = 'public' and indexname = 'uq_messages_instance_msgid'
);

-- (2b) E deve ser realmente parcial (where message_id is not null) e único.
select 'uq_messages_instance_msgid nao eh unico/parcial esperado'
from pg_indexes
where schemaname = 'public'
  and indexname = 'uq_messages_instance_msgid'
  and (indexdef not ilike '%unique%'
       or indexdef not ilike '%message_id IS NOT NULL%');

-- (3) Prova de dedup: dois inserts com o mesmo (instance_id, message_id) e
--     'on conflict do nothing' resultam em exatamente 1 linha.
--     Dados descartáveis criados dentro da transação (rollback ao final).
insert into myia_companies (id, name)
  values ('dddddddd-0000-4000-8000-000000000001', 'Empresa Teste 0011');

insert into myia_chat (id, company_id, instance_id)
  values ('dddddddd-0000-4000-8000-000000000002',
          'dddddddd-0000-4000-8000-000000000001', 'test_inst_0011');

insert into myia_messages (chat_id, instance_id, message_id, from_me, status)
  values ('dddddddd-0000-4000-8000-000000000002', 'test_inst_0011', 'DUP0011', false, 'RECEIVED');

insert into myia_messages (chat_id, instance_id, message_id, from_me, status)
  values ('dddddddd-0000-4000-8000-000000000002', 'test_inst_0011', 'DUP0011', false, 'RECEIVED')
  on conflict (instance_id, message_id) where message_id is not null do nothing;

select 'dedup falhou: ' || count(*) || ' linhas (esperado 1)'
from myia_messages
where instance_id = 'test_inst_0011' and message_id = 'DUP0011'
having count(*) <> 1;
