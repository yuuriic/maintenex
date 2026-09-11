-- Configuração do dashboard por empresa.
-- O layout é JSONB porque a lista de visuais evolui sem migrações por campo;
-- a aplicação valida tipos, ordem, dados e limites antes de renderizar/salvar.
begin;

create table if not exists public.dashboard_configuracoes (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  layout jsonb not null default '{"versao":1,"widgets":[]}'::jsonb,
  atualizado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_dashboard_config_atualizado_por
  on public.dashboard_configuracoes (atualizado_por)
  where atualizado_por is not null;

create or replace function public.dashboard_config_atualizar_data()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists dashboard_config_atualizado_em on public.dashboard_configuracoes;
create trigger dashboard_config_atualizado_em
before update on public.dashboard_configuracoes
for each row execute function public.dashboard_config_atualizar_data();

alter table public.dashboard_configuracoes enable row level security;

drop policy if exists "dashboard_config_select" on public.dashboard_configuracoes;
drop policy if exists "dashboard_config_insert" on public.dashboard_configuracoes;
drop policy if exists "dashboard_config_update" on public.dashboard_configuracoes;

create policy "dashboard_config_select" on public.dashboard_configuracoes
  for select to authenticated
  using (empresa_id = public.empresa_atual() or public.eh_super_admin());

create policy "dashboard_config_insert" on public.dashboard_configuracoes
  for insert to authenticated
  with check (
    (empresa_id = public.empresa_atual() and public.pode_administrar_empresa())
    or public.eh_super_admin()
  );

create policy "dashboard_config_update" on public.dashboard_configuracoes
  for update to authenticated
  using (
    (empresa_id = public.empresa_atual() and public.pode_administrar_empresa())
    or public.eh_super_admin()
  )
  with check (
    (empresa_id = public.empresa_atual() and public.pode_administrar_empresa())
    or public.eh_super_admin()
  );

revoke all on table public.dashboard_configuracoes from anon;
grant select on table public.dashboard_configuracoes to authenticated;
grant insert, update on table public.dashboard_configuracoes to authenticated;
revoke delete, truncate, references, trigger, maintain on table public.dashboard_configuracoes from authenticated;
revoke all on function public.dashboard_config_atualizar_data() from public, anon, authenticated, service_role;

commit;
