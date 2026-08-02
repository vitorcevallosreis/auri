-- myia_appointment_feedback — pesquisa de satisfação pós-consulta.
--
-- Por que agora: o painel exibe "Satisfação do Paciente" e um bloco de NPS, mas
-- não existia nenhuma coluna no schema capaz de sustentar esses números — eram
-- literais no src/app/page.tsx (4.8, e NPS 75 com 650/250/100). Nota de
-- satisfação e NPS são respostas de pesquisa: pertencem a uma linha própria,
-- não a um campo de myia_appointments (uma consulta pode não ter resposta, e a
-- resposta chega depois, por outro canal).
--
-- rating: 1 a 5 estrelas -> alimenta o card "Satisfação do Paciente".
-- nps_score: 0 a 10, a pergunta clássica de recomendação -> alimenta o NPSScore
--   (promotores 9-10, neutros 7-8, detratores 0-6).

create table if not exists myia_appointment_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  appointment_id uuid not null references myia_appointments(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  nps_score smallint not null check (nps_score between 0 and 10),
  comment text,
  created_at timestamptz not null default now(),
  -- Uma resposta por consulta; reenvio atualiza a linha existente.
  unique (appointment_id)
);

-- O painel agrega por empresa e recorta por período.
create index if not exists idx_myia_appointment_feedback_company_created
  on myia_appointment_feedback(company_id, created_at desc);

-- Mesmo padrão multi-tenant das demais tabelas (migration 0007).
alter table myia_appointment_feedback enable row level security;

-- `create policy` não aceita IF NOT EXISTS; o drop antes torna a migration
-- reexecutável (mesma razão documentada em 0012).
drop policy if exists myia_appointment_feedback_tenant_all on myia_appointment_feedback;

create policy myia_appointment_feedback_tenant_all on myia_appointment_feedback
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

grant select, insert, update, delete on myia_appointment_feedback
  to anon, authenticated, service_role;
