-- Hardening de integridade multi-tenant.
-- Toda relação entre tabelas tenant-scoped passa a carregar empresa_id na FK.

begin;

-- =========================================================
-- Preflight: falha explicitamente se houver inconsistência legada.
-- A migration não corrige nem apaga dados automaticamente.
-- =========================================================
do $$
declare
  violations text;
begin
  with checks as (
    select 'profiles.cidade_id -> cidades' as relation, count(*) as quantity
    from public.profiles p
    left join public.cidades c on c.id = p.cidade_id
    where p.cidade_id is not null
      and (c.id is null or p.empresa_id is distinct from c.empresa_id)

    union all

    select 'profiles.empresa_id NULL exige cidade_id NULL', count(*)
    from public.profiles p
    where p.empresa_id is null
      and p.cidade_id is not null

    union all

    select 'setores.cidade_id -> cidades', count(*)
    from public.setores s
    left join public.cidades c on c.id = s.cidade_id
    where c.id is null
       or s.empresa_id is distinct from c.empresa_id

    union all

    select 'equipamentos.cidade_id -> cidades', count(*)
    from public.equipamentos e
    left join public.cidades c on c.id = e.cidade_id
    where c.id is null
       or e.empresa_id is distinct from c.empresa_id

    union all

    select 'equipamentos.setor_id/cidade_id -> setores', count(*)
    from public.equipamentos e
    left join public.setores s on s.id = e.setor_id
    where e.setor_id is not null
      and (s.id is null
           or e.empresa_id is distinct from s.empresa_id
           or e.cidade_id is distinct from s.cidade_id)

    union all

    select 'checklists.equipamento_id -> equipamentos', count(*)
    from public.checklists cl
    left join public.equipamentos eq on eq.id = cl.equipamento_id
    where eq.id is null
       or cl.empresa_id is distinct from eq.empresa_id

    union all

    select 'checklists.responsavel_id -> profiles', count(*)
    from public.checklists cl
    left join public.profiles p on p.id = cl.responsavel_id
    where cl.responsavel_id is not null
      and (p.id is null or cl.empresa_id is distinct from p.empresa_id)

    union all

    select 'checklist_itens.checklist_id -> checklists', count(*)
    from public.checklist_itens ci
    left join public.checklists cl on cl.id = ci.checklist_id
    where cl.id is null
       or ci.empresa_id is distinct from cl.empresa_id

    union all

    select 'estoque.material_id -> materiais', count(*)
    from public.estoque es
    left join public.materiais m on m.id = es.material_id
    where m.id is null
       or es.empresa_id is distinct from m.empresa_id

    union all

    select 'estoque.cidade_id -> cidades', count(*)
    from public.estoque es
    left join public.cidades c on c.id = es.cidade_id
    where c.id is null
       or es.empresa_id is distinct from c.empresa_id

    union all

    select 'movimentacoes.material_id -> materiais', count(*)
    from public.movimentacoes mv
    left join public.materiais m on m.id = mv.material_id
    where m.id is null
       or mv.empresa_id is distinct from m.empresa_id

    union all

    select 'movimentacoes.cidade_id -> cidades', count(*)
    from public.movimentacoes mv
    left join public.cidades c on c.id = mv.cidade_id
    where c.id is null
       or mv.empresa_id is distinct from c.empresa_id

    union all

    select 'movimentacoes.equipamento_id -> equipamentos', count(*)
    from public.movimentacoes mv
    left join public.equipamentos eq on eq.id = mv.equipamento_id
    where mv.equipamento_id is not null
      and (eq.id is null or mv.empresa_id is distinct from eq.empresa_id)

    union all

    select 'movimentacoes.usuario_id -> profiles', count(*)
    from public.movimentacoes mv
    left join public.profiles p on p.id = mv.usuario_id
    where mv.usuario_id is not null
      and (p.id is null or mv.empresa_id is distinct from p.empresa_id)

    union all

    select 'pendencias.cidade_id -> cidades', count(*)
    from public.pendencias pe
    left join public.cidades c on c.id = pe.cidade_id
    where c.id is null
       or pe.empresa_id is distinct from c.empresa_id

    union all

    select 'pendencias.equipamento_id -> equipamentos', count(*)
    from public.pendencias pe
    left join public.equipamentos eq on eq.id = pe.equipamento_id
    where pe.equipamento_id is not null
      and (eq.id is null or pe.empresa_id is distinct from eq.empresa_id)

    union all

    select 'pendencias.responsavel_id -> profiles', count(*)
    from public.pendencias pe
    left join public.profiles p on p.id = pe.responsavel_id
    where pe.responsavel_id is not null
      and (p.id is null or pe.empresa_id is distinct from p.empresa_id)
  )
  select string_agg(format('%s=%s', relation, quantity), '; ' order by relation)
  into violations
  from checks
  where quantity > 0;

  if violations is not null then
    raise exception 'Preflight integridade multi-tenant falhou: %', violations
      using errcode = '23514';
  end if;
end $$;

-- =========================================================
-- Constraints únicas de suporte para FKs compostas.
-- =========================================================
alter table public.cidades
  add constraint cidades_id_empresa_id_key unique (id, empresa_id);

alter table public.setores
  add constraint setores_id_cidade_id_empresa_id_key unique (id, cidade_id, empresa_id);

alter table public.equipamentos
  add constraint equipamentos_id_empresa_id_key unique (id, empresa_id);

alter table public.checklists
  add constraint checklists_id_empresa_id_key unique (id, empresa_id);

alter table public.materiais
  add constraint materiais_id_empresa_id_key unique (id, empresa_id);

alter table public.profiles
  add constraint profiles_id_empresa_id_key unique (id, empresa_id);

alter table public.profiles
  add constraint profiles_empresa_null_cidade_null_chk
  check (empresa_id is not null or cidade_id is null);

-- =========================================================
-- Índices dos lados filhos das FKs compostas.
-- =========================================================
create index if not exists idx_profiles_cidade_empresa
  on public.profiles (cidade_id, empresa_id)
  where cidade_id is not null;

create index if not exists idx_setores_cidade_empresa
  on public.setores (cidade_id, empresa_id);

create index if not exists idx_equipamentos_cidade_empresa
  on public.equipamentos (cidade_id, empresa_id);

create index if not exists idx_equipamentos_setor_cidade_empresa
  on public.equipamentos (setor_id, cidade_id, empresa_id)
  where setor_id is not null;

create index if not exists idx_checklists_equipamento_empresa
  on public.checklists (equipamento_id, empresa_id);

create index if not exists idx_checklists_responsavel_empresa
  on public.checklists (responsavel_id, empresa_id)
  where responsavel_id is not null;

create index if not exists idx_checklist_itens_checklist_empresa
  on public.checklist_itens (checklist_id, empresa_id);

create index if not exists idx_estoque_material_empresa
  on public.estoque (material_id, empresa_id);

create index if not exists idx_estoque_cidade_empresa
  on public.estoque (cidade_id, empresa_id);

create index if not exists idx_movimentacoes_material_empresa
  on public.movimentacoes (material_id, empresa_id);

create index if not exists idx_movimentacoes_cidade_empresa
  on public.movimentacoes (cidade_id, empresa_id);

create index if not exists idx_movimentacoes_equipamento_empresa
  on public.movimentacoes (equipamento_id, empresa_id)
  where equipamento_id is not null;

create index if not exists idx_movimentacoes_usuario_empresa
  on public.movimentacoes (usuario_id, empresa_id)
  where usuario_id is not null;

create index if not exists idx_pendencias_cidade_empresa
  on public.pendencias (cidade_id, empresa_id);

create index if not exists idx_pendencias_equipamento_empresa
  on public.pendencias (equipamento_id, empresa_id)
  where equipamento_id is not null;

create index if not exists idx_pendencias_responsavel_empresa
  on public.pendencias (responsavel_id, empresa_id)
  where responsavel_id is not null;

-- =========================================================
-- Substituição de FKs simples por FKs compostas com empresa_id.
-- Nomes são preservados para evitar relações paralelas no PostgREST.
-- =========================================================
alter table public.profiles drop constraint if exists profiles_cidade_id_fkey;
alter table public.profiles
  add constraint profiles_cidade_id_fkey
  foreign key (cidade_id, empresa_id)
  references public.cidades (id, empresa_id)
  on delete set null (cidade_id);

alter table public.setores drop constraint if exists setores_cidade_id_fkey;
alter table public.setores
  add constraint setores_cidade_id_fkey
  foreign key (cidade_id, empresa_id)
  references public.cidades (id, empresa_id)
  on delete cascade;

alter table public.equipamentos drop constraint if exists equipamentos_cidade_id_fkey;
alter table public.equipamentos
  add constraint equipamentos_cidade_id_fkey
  foreign key (cidade_id, empresa_id)
  references public.cidades (id, empresa_id)
  on delete cascade;

alter table public.equipamentos drop constraint if exists equipamentos_setor_id_fkey;
alter table public.equipamentos
  add constraint equipamentos_setor_id_fkey
  foreign key (setor_id, cidade_id, empresa_id)
  references public.setores (id, cidade_id, empresa_id)
  on delete set null (setor_id);

alter table public.checklists drop constraint if exists checklists_equipamento_id_fkey;
alter table public.checklists
  add constraint checklists_equipamento_id_fkey
  foreign key (equipamento_id, empresa_id)
  references public.equipamentos (id, empresa_id)
  on delete cascade;

alter table public.checklists drop constraint if exists checklists_responsavel_id_fkey;
alter table public.checklists
  add constraint checklists_responsavel_id_fkey
  foreign key (responsavel_id, empresa_id)
  references public.profiles (id, empresa_id)
  on delete set null (responsavel_id);

alter table public.checklist_itens drop constraint if exists checklist_itens_checklist_id_fkey;
alter table public.checklist_itens
  add constraint checklist_itens_checklist_id_fkey
  foreign key (checklist_id, empresa_id)
  references public.checklists (id, empresa_id)
  on delete cascade;

alter table public.estoque drop constraint if exists estoque_material_id_fkey;
alter table public.estoque
  add constraint estoque_material_id_fkey
  foreign key (material_id, empresa_id)
  references public.materiais (id, empresa_id)
  on delete cascade;

alter table public.estoque drop constraint if exists estoque_cidade_id_fkey;
alter table public.estoque
  add constraint estoque_cidade_id_fkey
  foreign key (cidade_id, empresa_id)
  references public.cidades (id, empresa_id)
  on delete cascade;

alter table public.movimentacoes drop constraint if exists movimentacoes_material_id_fkey;
alter table public.movimentacoes
  add constraint movimentacoes_material_id_fkey
  foreign key (material_id, empresa_id)
  references public.materiais (id, empresa_id)
  on delete cascade;

alter table public.movimentacoes drop constraint if exists movimentacoes_cidade_id_fkey;
alter table public.movimentacoes
  add constraint movimentacoes_cidade_id_fkey
  foreign key (cidade_id, empresa_id)
  references public.cidades (id, empresa_id)
  on delete cascade;

alter table public.movimentacoes drop constraint if exists movimentacoes_equipamento_id_fkey;
alter table public.movimentacoes
  add constraint movimentacoes_equipamento_id_fkey
  foreign key (equipamento_id, empresa_id)
  references public.equipamentos (id, empresa_id)
  on delete set null (equipamento_id);

alter table public.movimentacoes drop constraint if exists movimentacoes_usuario_id_fkey;
alter table public.movimentacoes
  add constraint movimentacoes_usuario_id_fkey
  foreign key (usuario_id, empresa_id)
  references public.profiles (id, empresa_id)
  on delete set null (usuario_id);

alter table public.pendencias drop constraint if exists pendencias_cidade_id_fkey;
alter table public.pendencias
  add constraint pendencias_cidade_id_fkey
  foreign key (cidade_id, empresa_id)
  references public.cidades (id, empresa_id)
  on delete cascade;

alter table public.pendencias drop constraint if exists pendencias_equipamento_id_fkey;
alter table public.pendencias
  add constraint pendencias_equipamento_id_fkey
  foreign key (equipamento_id, empresa_id)
  references public.equipamentos (id, empresa_id)
  on delete set null (equipamento_id);

alter table public.pendencias drop constraint if exists pendencias_responsavel_id_fkey;
alter table public.pendencias
  add constraint pendencias_responsavel_id_fkey
  foreign key (responsavel_id, empresa_id)
  references public.profiles (id, empresa_id)
  on delete set null (responsavel_id);

-- =========================================================
-- unaccent_simples é utilitário interno do cadastro; não é endpoint RPC.
-- handle_new_user() continua funcionando por ser SECURITY DEFINER.
-- =========================================================
revoke execute on function public.unaccent_simples(text) from public;
revoke execute on function public.unaccent_simples(text) from anon;
revoke execute on function public.unaccent_simples(text) from authenticated;

commit;
