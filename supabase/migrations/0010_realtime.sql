-- Adiciona à publicação supabase_realtime exatamente as tabelas que o painel
-- assina via realtimeService.subscribeToTable(...) ou supabase.channel(...).on(
-- 'postgres_changes', ...). Sem isso, nenhum evento de INSERT/UPDATE/DELETE é
-- entregue aos clientes, mesmo com o listener configurado no front-end.
--
-- Tabelas e onde são assinadas:
--   myia_messages               src/contexts/Messages/index.tsx
--   myia_channels                src/contexts/Assistants/index.tsx
--   myia_contacts                src/contexts/Contacts/index.tsx
--   myia_chat                    src/contexts/typing/index.tsx, src/contexts/Chats/index.tsx
--   myia_company_policies        src/contexts/Company/index.tsx
--   myia_company_payment_methods src/contexts/Company/index.tsx
--
-- A publicação está vazia neste projeto (fresh), então `add table` simples é seguro.

alter publication supabase_realtime add table myia_messages;
alter publication supabase_realtime add table myia_channels;
alter publication supabase_realtime add table myia_contacts;
alter publication supabase_realtime add table myia_chat;
alter publication supabase_realtime add table myia_company_policies;
alter publication supabase_realtime add table myia_company_payment_methods;
