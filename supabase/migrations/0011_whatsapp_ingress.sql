-- Plano 2 (P2.1) — Suporte ao ingress de WhatsApp (Evolution API).
--
-- (a) Lookup rápido do tenant a partir do webhook: o handler resolve a instância
--     Evolution (payload.instance) para o canal via myia_channels."instanceWpp".
create index if not exists idx_channels_instancewpp
  on myia_channels ("instanceWpp");

-- (b) Idempotência do ingress: Evolution reenvia o mesmo evento em timeout. Um
--     índice único parcial em (instance_id, message_id) permite gravar a mensagem
--     recebida exatamente uma vez por instância. Parcial (where message_id is not
--     null) porque mensagens enviadas pelo painel podem não ter message_id ainda,
--     e NULLs não devem colidir entre si.
create unique index if not exists uq_messages_instance_msgid
  on myia_messages (instance_id, message_id)
  where message_id is not null;
