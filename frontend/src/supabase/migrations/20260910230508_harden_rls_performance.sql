-- Hardening de performance e previsibilidade das políticas RLS.
-- Reduz reavaliações por linha e mantém FKs indexadas sem abrir acesso novo.

begin;

-- FKs simples restantes sem índice cobrindo a coluna referenciada.
create index if not exists idx_checklist_itens_empresa
  on public.checklist_itens (empresa_id);
create index if not exists idx_convites_criado_por
  on public.convites (criado_por)
  where criado_por is not null;
create index if not exists idx_estoque_empresa
  on public.estoque (empresa_id);
create index if not exists idx_setores_empresa
  on public.setores (empresa_id);

-- Função interna não depende de objetos fora de pg_catalog.
create or replace function public.unaccent_simples(texto text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select translate(
    texto,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  )
$$;

-- Uma política por ação evita múltiplas políticas permissivas avaliadas juntas.
do $$
declare
  tabela text;
begin
  foreach tabela in array array['cidades','setores','equipamentos','materiais']
  loop
    execute format('drop policy if exists "tenant_select" on public.%I', tabela);
    execute format('drop policy if exists "cadastro_write" on public.%I', tabela);
    execute format('drop policy if exists "cadastro_insert" on public.%I', tabela);
    execute format('drop policy if exists "cadastro_update" on public.%I', tabela);
    execute format('drop policy if exists "cadastro_delete" on public.%I', tabela);

    execute format($policy$
      create policy "tenant_select" on public.%I
      for select to authenticated
      using (empresa_id = public.empresa_atual() or public.eh_super_admin())
    $policy$, tabela);

    execute format($policy$
      create policy "cadastro_insert" on public.%I
      for insert to authenticated
      with check (
        (empresa_id = public.empresa_atual() and public.pode_gerir_cadastro())
        or public.eh_super_admin()
      )
    $policy$, tabela);

    execute format($policy$
      create policy "cadastro_update" on public.%I
      for update to authenticated
      using (
        (empresa_id = public.empresa_atual() and public.pode_gerir_cadastro())
        or public.eh_super_admin()
      )
      with check (
        (empresa_id = public.empresa_atual() and public.pode_gerir_cadastro())
        or public.eh_super_admin()
      )
    $policy$, tabela);

    execute format($policy$
      create policy "cadastro_delete" on public.%I
      for delete to authenticated
      using (
        (empresa_id = public.empresa_atual() and public.pode_gerir_cadastro())
        or public.eh_super_admin()
      )
    $policy$, tabela);
  end loop;
end $$;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['checklists','checklist_itens','estoque','movimentacoes','pendencias']
  loop
    execute format('drop policy if exists "tenant_select" on public.%I', tabela);
    execute format('drop policy if exists "operacao_write" on public.%I', tabela);
    execute format('drop policy if exists "operacao_insert" on public.%I', tabela);
    execute format('drop policy if exists "operacao_update" on public.%I', tabela);
    execute format('drop policy if exists "operacao_delete" on public.%I', tabela);

    execute format($policy$
      create policy "tenant_select" on public.%I
      for select to authenticated
      using (empresa_id = public.empresa_atual() or public.eh_super_admin())
    $policy$, tabela);

    execute format($policy$
      create policy "operacao_insert" on public.%I
      for insert to authenticated
      with check (
        (empresa_id = public.empresa_atual() and public.pode_operar())
        or public.eh_super_admin()
      )
    $policy$, tabela);

    execute format($policy$
      create policy "operacao_update" on public.%I
      for update to authenticated
      using (
        (empresa_id = public.empresa_atual() and public.pode_operar())
        or public.eh_super_admin()
      )
      with check (
        (empresa_id = public.empresa_atual() and public.pode_operar())
        or public.eh_super_admin()
      )
    $policy$, tabela);

    execute format($policy$
      create policy "operacao_delete" on public.%I
      for delete to authenticated
      using (
        (empresa_id = public.empresa_atual() and public.pode_operar())
        or public.eh_super_admin()
      )
    $policy$, tabela);
  end loop;
end $$;

alter table public.empresas enable row level security;
drop policy if exists "empresa_select" on public.empresas;
drop policy if exists "empresa_insert" on public.empresas;
drop policy if exists "empresa_update" on public.empresas;
drop policy if exists "empresa_delete" on public.empresas;

create policy "empresa_select" on public.empresas
  for select to authenticated
  using (id = public.empresa_atual() or public.eh_super_admin());
create policy "empresa_insert" on public.empresas
  for insert to authenticated
  with check (public.eh_super_admin());
create policy "empresa_update" on public.empresas
  for update to authenticated
  using ((id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin())
  with check ((id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin());
create policy "empresa_delete" on public.empresas
  for delete to authenticated
  using (public.eh_super_admin());

alter table public.profiles enable row level security;
drop policy if exists "profile_select" on public.profiles;
drop policy if exists "profile_update_proprio" on public.profiles;
drop policy if exists "profile_admin" on public.profiles;
drop policy if exists "profile_admin_insert" on public.profiles;
drop policy if exists "profile_admin_update" on public.profiles;
drop policy if exists "profile_admin_delete" on public.profiles;
drop policy if exists "profile_update" on public.profiles;

create policy "profile_select" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or empresa_id = public.empresa_atual()
    or public.eh_super_admin()
  );
create policy "profile_admin_insert" on public.profiles
  for insert to authenticated
  with check (
    (empresa_id = public.empresa_atual() and public.pode_administrar_empresa())
    or public.eh_super_admin()
  );
create policy "profile_update" on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin())
  )
  with check (
    id = (select auth.uid())
    or ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin())
  );
create policy "profile_admin_delete" on public.profiles
  for delete to authenticated
  using (
    (empresa_id = public.empresa_atual() and public.pode_administrar_empresa())
    or public.eh_super_admin()
  );

alter table public.convites enable row level security;
drop policy if exists "convite_admin" on public.convites;
create policy "convite_admin" on public.convites
  for all to authenticated
  using ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin())
  with check ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin());

commit;
