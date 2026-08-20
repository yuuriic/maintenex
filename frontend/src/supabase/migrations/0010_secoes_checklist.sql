-- Organiza visualmente os itens sem alterar checklists já existentes.

begin;

alter table public.checklist_itens
  add column if not exists secao text;

comment on column public.checklist_itens.secao is
  'Grupo funcional do item no formulário e na execução do checklist.';

commit;
