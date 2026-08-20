-- =========================================================================
-- Maintenex :: setup completo do banco
--
-- Arquivo único e idempotente: pode ser executado quantas vezes for preciso.
-- Cole inteiro no SQL Editor do Supabase e clique em Run.
--
-- Contém, nesta ordem:
--   1. schema multiempresa (tabelas, enums, índices)
--   2. triggers de cadastro, estoque e proteção de papéis
--   3. RLS por empresa e por papel
--   4. dados de demonstração (só populam depois que existir uma empresa)
--
-- Depois de rodar: crie sua conta em /login?modo=cadastrar informando o nome
-- da empresa. Rode este arquivo de novo para o seed popular a empresa criada.
-- =========================================================================

-- =========================================================
-- Maintenex :: schema inicial (Supabase / Postgres)
-- Multi-tenant em 3 níveis:
--   super_admin  -> plataforma (empresa_id nulo), enxerga tudo
--   owner        -> responsável pela empresa, convida e define papéis
--   gestor/tecnico/leitor -> equipe da empresa
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- Enums
-- =========================================================
do $$ begin
  create type papel_usuario as enum ('super_admin', 'owner', 'gestor', 'tecnico', 'leitor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_empresa as enum ('ativa', 'suspensa', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_equipamento as enum ('ativo', 'manutencao', 'inativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_checklist as enum ('preventiva', 'corretiva');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_checklist as enum ('pendente', 'em_andamento', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridade_pendencia as enum ('baixa', 'media', 'alta', 'critica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_pendencia as enum ('aberta', 'em_andamento', 'resolvida', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_movimentacao as enum ('entrada', 'saida', 'ajuste');
exception when duplicate_object then null; end $$;

-- =========================================================
-- Tenant
-- =========================================================
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  cnpj text unique,
  email_principal text,
  telefone text,
  status status_empresa not null default 'ativa',
  criado_por uuid,
  criado_em timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references empresas(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  telefone text,
  email_verificado boolean not null default false,
  papel papel_usuario not null default 'tecnico',
  cidade_id uuid,
  avatar_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Mantém instalações existentes alinhadas com as migrations incrementais.
alter table profiles
  add column if not exists telefone text,
  add column if not exists email_verificado boolean not null default false;

create index if not exists idx_profiles_telefone on profiles (telefone);

create table if not exists convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  email text not null,
  papel papel_usuario not null default 'tecnico',
  criado_por uuid references profiles(id) on delete set null,
  aceito_em timestamptz,
  expira_em timestamptz not null default now() + interval '14 days',
  criado_em timestamptz not null default now(),
  unique (empresa_id, email)
);

-- =========================================================
-- Domínio
-- =========================================================
create table if not exists cidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  uf char(2) not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (empresa_id, nome, uf)
);

alter table profiles drop constraint if exists profiles_cidade_id_fkey;
alter table profiles add constraint profiles_cidade_id_fkey
  foreign key (cidade_id) references cidades(id) on delete set null;

create table if not exists setores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cidade_id uuid not null references cidades(id) on delete cascade,
  nome text not null,
  responsavel text,
  criado_em timestamptz not null default now(),
  unique (cidade_id, nome)
);

create table if not exists equipamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cidade_id uuid not null references cidades(id) on delete cascade,
  setor_id uuid references setores(id) on delete set null,
  codigo text not null,
  nome text not null,
  marca text,
  modelo text,
  numero_serie text,
  localizacao text,
  status status_equipamento not null default 'ativo',
  contador integer not null default 0,
  ultima_manutencao date,
  proxima_manutencao date,
  criado_em timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  equipamento_id uuid not null references equipamentos(id) on delete cascade,
  tipo tipo_checklist not null default 'preventiva',
  status status_checklist not null default 'pendente',
  titulo text not null,
  responsavel_id uuid references profiles(id) on delete set null,
  tecnico_nome text,
  data_prevista date not null default current_date,
  data_conclusao timestamptz,
  observacoes text,
  criado_em timestamptz not null default now()
);

alter table checklists add column if not exists tecnico_nome text;

create table if not exists checklist_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  checklist_id uuid not null references checklists(id) on delete cascade,
  descricao text not null,
  concluido boolean not null default false,
  observacao text,
  ordem integer not null default 0
);

create table if not exists materiais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  categoria text,
  unidade text not null default 'un',
  estoque_minimo integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table if not exists estoque (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  material_id uuid not null references materiais(id) on delete cascade,
  cidade_id uuid not null references cidades(id) on delete cascade,
  quantidade integer not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (material_id, cidade_id)
);

create table if not exists movimentacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  material_id uuid not null references materiais(id) on delete cascade,
  cidade_id uuid not null references cidades(id) on delete cascade,
  equipamento_id uuid references equipamentos(id) on delete set null,
  tipo tipo_movimentacao not null,
  quantidade integer not null check (quantidade > 0),
  motivo text,
  usuario_id uuid references profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists pendencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cidade_id uuid not null references cidades(id) on delete cascade,
  equipamento_id uuid references equipamentos(id) on delete set null,
  titulo text not null,
  descricao text,
  prioridade prioridade_pendencia not null default 'media',
  status status_pendencia not null default 'aberta',
  responsavel_id uuid references profiles(id) on delete set null,
  aberta_em timestamptz not null default now(),
  fechada_em timestamptz
);

create index if not exists idx_profiles_empresa on profiles(empresa_id);
create index if not exists idx_cidades_empresa on cidades(empresa_id);
create index if not exists idx_equip_empresa on equipamentos(empresa_id);
create index if not exists idx_equip_cidade on equipamentos(cidade_id);
create index if not exists idx_check_empresa on checklists(empresa_id);
create index if not exists idx_check_equip on checklists(equipamento_id);
create index if not exists idx_mov_empresa on movimentacoes(empresa_id);
create index if not exists idx_mov_criado on movimentacoes(criado_em desc);
create index if not exists idx_pend_empresa on pendencias(empresa_id);
create index if not exists idx_convites_email on convites(lower(email));

-- =========================================================
-- Utilitários
-- =========================================================
-- normalização simples de acentos para o slug (evita depender da extensão unaccent)
create or replace function public.unaccent_simples(texto text)
returns text language sql immutable as $$
  select translate(
    texto,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  )
$$;

-- =========================================================
-- Novo usuário: auto-cadastro de empresa OU convite pendente
-- =========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nome_empresa text := nullif(trim(new.raw_user_meta_data->>'empresa_nome'), '');
  nome_usuario text := coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1));
  convite convites%rowtype;
  empresa empresas%rowtype;
  base_slug text;
  slug_final text;
  sufixo integer := 0;
begin
  -- 1) convite pendente para este e-mail tem prioridade
  select * into convite
  from convites
  where lower(email) = lower(new.email)
    and aceito_em is null
    and expira_em > now()
  order by criado_em desc
  limit 1;

  if found then
    insert into profiles (id, empresa_id, nome, email, papel)
    values (new.id, convite.empresa_id, nome_usuario, new.email, convite.papel)
    on conflict (id) do update
      set empresa_id = excluded.empresa_id, papel = excluded.papel;

    update convites set aceito_em = now() where id = convite.id;
    return new;
  end if;

  -- 2) auto-cadastro: criou conta informando o nome da empresa -> vira owner
  if nome_empresa is not null then
    base_slug := regexp_replace(lower(unaccent_simples(nome_empresa)), '[^a-z0-9]+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    slug_final := base_slug;
    while exists (select 1 from empresas e where e.slug = slug_final) loop
      sufixo := sufixo + 1;
      slug_final := base_slug || '-' || sufixo;
    end loop;

    insert into empresas (nome, slug, email_principal, criado_por)
    values (nome_empresa, slug_final, new.email, new.id)
    returning * into empresa;

    insert into profiles (id, empresa_id, nome, email, papel)
    values (new.id, empresa.id, nome_usuario, new.email, 'owner')
    on conflict (id) do update
      set empresa_id = excluded.empresa_id, papel = excluded.papel;
    return new;
  end if;

  -- 3) sem convite e sem empresa -> profile órfão (a UI pede para criar/entrar numa empresa)
  insert into profiles (id, nome, email, papel)
  values (new.id, nome_usuario, new.email, 'leitor')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Movimentação atualiza o saldo do estoque
-- =========================================================
create or replace function public.aplicar_movimentacao()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta integer;
begin
  delta := case new.tipo
    when 'entrada' then new.quantidade
    when 'saida'   then -new.quantidade
    else new.quantidade
  end;

  insert into estoque (empresa_id, material_id, cidade_id, quantidade, atualizado_em)
  values (new.empresa_id, new.material_id, new.cidade_id, greatest(delta, 0), now())
  on conflict (material_id, cidade_id) do update
    set quantidade = case
          when new.tipo = 'ajuste' then new.quantidade
          else greatest(estoque.quantidade + delta, 0)
        end,
        atualizado_em = now();
  return new;
end $$;

drop trigger if exists on_movimentacao_created on movimentacoes;
create trigger on_movimentacao_created
  after insert on movimentacoes
  for each row execute function public.aplicar_movimentacao();

-- =========================================================
-- Guardas de integridade (o que RLS sozinha não protege bem)
-- =========================================================

-- Impede auto-escalação: ninguém muda o próprio papel ou a própria empresa,
-- e só super_admin pode conceder o papel de super_admin.
create or replace function public.proteger_papel()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meu_papel papel_usuario;
  minha_empresa uuid;
begin
  select papel, empresa_id into meu_papel, minha_empresa from profiles where id = auth.uid();

  -- operações internas (triggers, service_role, seeds) não têm auth.uid()
  if auth.uid() is null then
    return new;
  end if;

  if meu_papel = 'super_admin' then
    return new;
  end if;

  -- o próprio usuário nunca altera papel nem empresa
  if new.id = auth.uid() and (
     new.papel is distinct from old.papel
     or new.empresa_id is distinct from old.empresa_id
     or new.ativo is distinct from old.ativo
     or new.email is distinct from old.email
     or new.telefone is distinct from old.telefone
     or new.email_verificado is distinct from old.email_verificado
     or new.criado_em is distinct from old.criado_em
  ) then
    raise exception 'Você não pode alterar campos protegidos do próprio perfil.';
  end if;

  -- somente super_admin concede super_admin
  if new.papel = 'super_admin' and old.papel is distinct from 'super_admin' then
    raise exception 'Somente a administração da plataforma concede o papel super_admin.';
  end if;

  -- owner administra apenas dentro da própria empresa
  if meu_papel = 'owner' then
    if new.empresa_id is distinct from minha_empresa or old.empresa_id is distinct from minha_empresa then
      raise exception 'Você só administra usuários da sua própria empresa.';
    end if;
    return new;
  end if;

  -- demais papéis não alteram papel/empresa de ninguém
  if new.papel is distinct from old.papel or new.empresa_id is distinct from old.empresa_id then
    raise exception 'Sem permissão para alterar papel ou empresa.';
  end if;

  return new;
end $$;

drop trigger if exists on_profile_update on profiles;
create trigger on_profile_update
  before update on profiles
  for each row execute function public.proteger_papel();

-- Convite nunca concede super_admin, e é sempre da empresa de quem convida.
create or replace function public.proteger_convite()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meu_papel papel_usuario;
  minha_empresa uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  select papel, empresa_id into meu_papel, minha_empresa from profiles where id = auth.uid();

  if new.papel = 'super_admin' then
    raise exception 'Convite não pode conceder o papel super_admin.';
  end if;

  if meu_papel <> 'super_admin' and new.empresa_id is distinct from minha_empresa then
    raise exception 'Você só convida para a sua própria empresa.';
  end if;

  return new;
end $$;

drop trigger if exists on_convite_write on convites;
create trigger on_convite_write
  before insert or update on convites
  for each row execute function public.proteger_convite();

-- =========================================================
-- RLS
-- =========================================================

-- Usuário desativado perde acesso de escrita e leitura (helpers retornam nulo/false).
create or replace function public.empresa_atual()
returns uuid language sql stable security definer set search_path = public as $$
  select p.empresa_id
  from profiles p
  join empresas e on e.id = p.empresa_id
  where p.id = auth.uid() and p.ativo and e.status = 'ativa'
$$;

create or replace function public.eh_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'super_admin' and ativo from profiles where id = auth.uid()), false)
$$;

create or replace function public.pode_administrar_empresa()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('super_admin', 'owner') and ativo from profiles where id = auth.uid()), false)
$$;

-- gestor+ mantém cadastros (cidades, setores, equipamentos, materiais)
create or replace function public.pode_gerir_cadastro()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('super_admin', 'owner', 'gestor') and ativo from profiles where id = auth.uid()), false)
$$;

-- tecnico+ registra operação (checklists, movimentações, pendências)
create or replace function public.pode_operar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('super_admin', 'owner', 'gestor', 'tecnico') and ativo from profiles where id = auth.uid()), false)
$$;

-- Nenhum acesso anônimo aos dados
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Funções de trigger não são endpoints RPC públicos.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.aplicar_movimentacao() from public, anon, authenticated;
revoke all on function public.proteger_papel() from public, anon, authenticated;
revoke all on function public.proteger_convite() from public, anon, authenticated;

-- Helpers das políticas podem ser chamados apenas pela sessão autenticada.
revoke all on function public.empresa_atual() from public, anon;
revoke all on function public.eh_super_admin() from public, anon;
revoke all on function public.pode_administrar_empresa() from public, anon;
revoke all on function public.pode_gerir_cadastro() from public, anon;
revoke all on function public.pode_operar() from public, anon;
grant execute on function public.empresa_atual() to authenticated;
grant execute on function public.eh_super_admin() to authenticated;
grant execute on function public.pode_administrar_empresa() to authenticated;
grant execute on function public.pode_gerir_cadastro() to authenticated;
grant execute on function public.pode_operar() to authenticated;

-- --- Cadastros: leitura para a empresa, escrita para gestor+ --------------
do $$
declare t text;
begin
  foreach t in array array['cidades','setores','equipamentos','materiais']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "tenant_select" on %I', t);
    execute format('drop policy if exists "tenant_write" on %I', t);
    execute format('drop policy if exists "cadastro_write" on %I', t);
    execute format($p$
      create policy "tenant_select" on %I for select to authenticated
      using (empresa_id = public.empresa_atual() or public.eh_super_admin())
    $p$, t);
    execute format($p$
      create policy "cadastro_write" on %I for all to authenticated
      using ((empresa_id = public.empresa_atual() and public.pode_gerir_cadastro()) or public.eh_super_admin())
      with check ((empresa_id = public.empresa_atual() and public.pode_gerir_cadastro()) or public.eh_super_admin())
    $p$, t);
  end loop;
end $$;

-- --- Operação: leitura para a empresa, escrita para tecnico+ --------------
do $$
declare t text;
begin
  foreach t in array array['checklists','checklist_itens','estoque','movimentacoes','pendencias']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "tenant_select" on %I', t);
    execute format('drop policy if exists "tenant_write" on %I', t);
    execute format('drop policy if exists "operacao_write" on %I', t);
    execute format($p$
      create policy "tenant_select" on %I for select to authenticated
      using (empresa_id = public.empresa_atual() or public.eh_super_admin())
    $p$, t);
    execute format($p$
      create policy "operacao_write" on %I for all to authenticated
      using ((empresa_id = public.empresa_atual() and public.pode_operar()) or public.eh_super_admin())
      with check ((empresa_id = public.empresa_atual() and public.pode_operar()) or public.eh_super_admin())
    $p$, t);
  end loop;
end $$;

-- --- Empresas ------------------------------------------------------------
alter table empresas enable row level security;
drop policy if exists "empresa_select" on empresas;
drop policy if exists "empresa_insert" on empresas;
drop policy if exists "empresa_update" on empresas;
drop policy if exists "empresa_delete" on empresas;

create policy "empresa_select" on empresas for select to authenticated
  using (id = public.empresa_atual() or public.eh_super_admin());

create policy "empresa_insert" on empresas for insert to authenticated
  with check (public.eh_super_admin());

create policy "empresa_update" on empresas for update to authenticated
  using ((id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin())
  with check ((id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin());

create policy "empresa_delete" on empresas for delete to authenticated
  using (public.eh_super_admin());

-- --- Profiles ------------------------------------------------------------
alter table profiles enable row level security;
drop policy if exists "profile_select" on profiles;
drop policy if exists "profile_update_proprio" on profiles;
drop policy if exists "profile_admin" on profiles;

create policy "profile_select" on profiles for select to authenticated
  using (id = auth.uid() or empresa_id = public.empresa_atual() or public.eh_super_admin());

-- o próprio usuário edita seus dados; o trigger proteger_papel() bloqueia papel/empresa
create policy "profile_update_proprio" on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- owner/super_admin administram os perfis da própria empresa
create policy "profile_admin" on profiles for all to authenticated
  using ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin())
  with check ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin());

-- --- Convites ------------------------------------------------------------
alter table convites enable row level security;
drop policy if exists "convite_admin" on convites;
create policy "convite_admin" on convites for all to authenticated
  using ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin())
  with check ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin());


-- =========================================================
-- Maintenex :: dados de demonstração (idempotente)
--
-- Popula a PRIMEIRA empresa cadastrada. Rode depois de criar sua conta
-- pelo app (o auto-cadastro cria a empresa). Sem empresa, não faz nada.
-- =========================================================

do $$
declare
  emp uuid;
begin
  select id into emp from empresas order by criado_em limit 1;

  if emp is null then
    raise notice 'Nenhuma empresa cadastrada — seed ignorado. Crie a conta pelo app e rode de novo.';
    return;
  end if;

  raise notice 'Populando empresa %', emp;

  -- Cidades ------------------------------------------------
  insert into cidades (empresa_id, nome, uf)
  select emp, v.nome, v.uf
  from (values ('Paranaguá', 'PR'), ('Curitiba', 'PR'), ('Joinville', 'SC')) as v(nome, uf)
  on conflict (empresa_id, nome, uf) do nothing;

  -- Setores ------------------------------------------------
  insert into setores (empresa_id, cidade_id, nome, responsavel)
  select emp, c.id, s.nome, s.resp
  from cidades c
  cross join (values
    ('Administrativo', 'Ana Souza'),
    ('Operacional', 'Bruno Lima'),
    ('Almoxarifado Central', 'Carla Dias'),
    ('Manutenção', 'Diego Alves')
  ) as s(nome, resp)
  where c.empresa_id = emp
  on conflict (cidade_id, nome) do nothing;

  -- Materiais ----------------------------------------------
  insert into materiais (empresa_id, codigo, nome, categoria, unidade, estoque_minimo)
  select emp, v.codigo, v.nome, v.categoria, v.unidade, v.minimo
  from (values
    ('MAT-001', 'Toner Preto HP 26A', 'Suprimento', 'un', 10),
    ('MAT-002', 'Cilindro Fotocondutor', 'Peça', 'un', 5),
    ('MAT-003', 'Kit Manutenção 200k', 'Kit', 'kit', 2),
    ('MAT-004', 'Rolo de Tração', 'Peça', 'un', 8),
    ('MAT-005', 'Fusor 220V', 'Peça', 'un', 3),
    ('MAT-006', 'Álcool Isopropílico 1L', 'Consumível', 'l', 12),
    ('MAT-007', 'Pano Antiestático', 'Consumível', 'pct', 15),
    ('MAT-008', 'Correia de Transferência', 'Peça', 'un', 4)
  ) as v(codigo, nome, categoria, unidade, minimo)
  on conflict (empresa_id, codigo) do nothing;

  -- Equipamentos -------------------------------------------
  insert into equipamentos (empresa_id, cidade_id, setor_id, codigo, nome, marca, modelo,
                            numero_serie, localizacao, status, contador, ultima_manutencao, proxima_manutencao)
  select
    emp,
    c.id,
    (select s.id from setores s where s.cidade_id = c.id order by s.nome limit 1),
    'EQP-' || upper(left(c.uf, 2)) || '-' || lpad(g::text, 3, '0'),
    (array['Multifuncional','Impressora Laser','Scanner de Produção','Plotter'])[1 + (g % 4)] || ' ' ||
      (array['A3','A4','Color','Mono'])[1 + (g % 4)],
    (array['HP','Brother','Kyocera','Epson'])[1 + (g % 4)],
    (array['M428fdw','MFC-L8900','ECOSYS M3145','WF-C5790'])[1 + (g % 4)],
    'SN' || lpad((10000 + g * 37)::text, 8, '0'),
    'Sala ' || (100 + g),
    (array['ativo','ativo','ativo','manutencao','inativo'])[1 + (g % 5)]::status_equipamento,
    5000 + g * 1234,
    current_date - ((g % 90) || ' days')::interval,
    current_date + ((30 - (g % 30)) || ' days')::interval
  from cidades c, generate_series(1, 8) g
  where c.empresa_id = emp
  on conflict (empresa_id, codigo) do nothing;

  -- Checklists ---------------------------------------------
  insert into checklists (empresa_id, equipamento_id, tipo, status, titulo, data_prevista, data_conclusao)
  select
    emp, e.id,
    (array['preventiva','preventiva','preventiva','corretiva'])[1 + (g % 4)]::tipo_checklist,
    (array['concluido','concluido','pendente','em_andamento'])[1 + (g % 4)]::status_checklist,
    (array['Limpeza geral','Troca de suprimento','Revisão mecânica','Correção de atolamento'])[1 + (g % 4)],
    current_date - ((g * 7) % 120),
    case when g % 4 < 2 then now() - (((g * 7) % 120) || ' days')::interval end
  from equipamentos e, generate_series(1, 3) g
  where e.empresa_id = emp
    and not exists (select 1 from checklists cl where cl.equipamento_id = e.id);

  -- Itens de checklist -------------------------------------
  insert into checklist_itens (empresa_id, checklist_id, descricao, concluido, ordem)
  select emp, cl.id, i.descricao, cl.status = 'concluido', i.ordem
  from checklists cl
  cross join lateral (
    select * from (values
      ('Verificar contador de páginas', 1),
      ('Limpar vidro e ADF', 2),
      ('Conferir nível de suprimentos', 3),
      ('Testar impressão de página de teste', 4),
      ('Registrar ocorrências', 5)
    ) as preventiva(descricao, ordem)
    where cl.tipo = 'preventiva'
    union all
    select * from (values
      ('Identificar e registrar a falha', 1),
      ('Diagnosticar a causa do problema', 2),
      ('Executar o reparo ou a substituição necessária', 3),
      ('Testar o funcionamento após o reparo', 4),
      ('Registrar peças utilizadas e recomendações', 5)
    ) as corretiva(descricao, ordem)
    where cl.tipo = 'corretiva'
  ) as i
  where cl.empresa_id = emp
    and not exists (select 1 from checklist_itens ci where ci.checklist_id = cl.id);

  -- Movimentações (o trigger atualiza o estoque) -----------
  insert into movimentacoes (empresa_id, material_id, cidade_id, tipo, quantidade, motivo, criado_em)
  select
    emp, m.id, c.id,
    (array['entrada','saida','saida','entrada'])[1 + (g % 4)]::tipo_movimentacao,
    1 + (g % 9),
    (array['Compra','Consumo em preventiva','Consumo em corretiva','Reposição'])[1 + (g % 4)],
    now() - ((g * 5) || ' days')::interval
  from materiais m, cidades c, generate_series(1, 4) g
  where m.empresa_id = emp and c.empresa_id = emp
    and not exists (select 1 from movimentacoes mv where mv.material_id = m.id and mv.cidade_id = c.id);

  -- Pendências ---------------------------------------------
  insert into pendencias (empresa_id, cidade_id, equipamento_id, titulo, descricao,
                          prioridade, status, aberta_em, fechada_em)
  select
    emp, e.cidade_id, e.id,
    (array['Ruído anormal no fusor','Falha de rede intermitente','Atolamento recorrente','Qualidade de impressão baixa'])[1 + (g % 4)],
    'Registrado durante inspeção de rotina no equipamento ' || e.codigo || '.',
    (array['baixa','media','alta','critica'])[1 + (g % 4)]::prioridade_pendencia,
    (array['aberta','aberta','em_andamento','resolvida'])[1 + (g % 4)]::status_pendencia,
    now() - ((g * 9) || ' days')::interval,
    case when g % 4 = 3 then now() - ((g * 3) || ' days')::interval end
  from equipamentos e, generate_series(1, 2) g
  where e.empresa_id = emp
    and not exists (select 1 from pendencias p where p.equipamento_id = e.id);
end $$;


-- =========================================================================
-- Conferência final: o que foi criado
-- =========================================================================
do $$
declare
  qtd_tabelas integer;
  qtd_policies integer;
  qtd_triggers integer;
  qtd_empresas integer;
begin
  select count(*) into qtd_tabelas
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('empresas','profiles','convites','cidades','setores','equipamentos',
                       'checklists','checklist_itens','materiais','estoque','movimentacoes','pendencias');

  select count(*) into qtd_policies from pg_policies where schemaname = 'public';

  select count(*) into qtd_triggers
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where not t.tgisinternal and c.relnamespace = 'public'::regnamespace;

  select count(*) into qtd_empresas from empresas;

  raise notice '--------------------------------------------';
  raise notice 'Maintenex :: setup concluido';
  raise notice 'tabelas ...... % de 12', qtd_tabelas;
  raise notice 'policies RLS . %', qtd_policies;
  raise notice 'triggers ..... %', qtd_triggers;
  raise notice 'empresas ..... %', qtd_empresas;
  if qtd_empresas = 0 then
    raise notice 'proximo passo: crie sua conta em /login?modo=cadastrar';
    raise notice 'e rode este arquivo de novo para popular os dados de exemplo.';
  end if;
  raise notice '--------------------------------------------';
end $$;
