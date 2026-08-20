-- Registra a identificação informada pelo técnico que executou o checklist.
-- O campo é opcional no banco para preservar checklists criados anteriormente.

begin;

alter table public.checklists
  add column if not exists tecnico_nome text;

comment on column public.checklists.tecnico_nome is
  'Nome informado pelo técnico responsável pela execução do checklist.';

commit;
