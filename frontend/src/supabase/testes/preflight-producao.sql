-- Preflight READ-ONLY para produção antes de `migration repair` + `db push`.
-- Somente SELECT sobre catálogos e contagens agregadas (nenhum dado pessoal).
-- Uso (Management API, sem link persistente):
--   supabase db query --linked --project-ref <REF> --workdir frontend/src -f frontend/src/supabase/testes/preflight-producao.sql
-- Resultado aceitável: todas as linhas com esperado = obtido (coluna ok = true)
-- e a seção 0012 com quantity = 0 em todas as relações.

-- 1) Histórico remoto atual (para conferir o plano de repair)
select 'history' as secao, version, name
from supabase_migrations.schema_migrations
order by version;

-- 2) Marcadores de schema: o que já existe de fato em produção
select 'marcadores' as secao, marcador, obtido, esperado, obtido = esperado as ok
from (
  values
    ('0006 profiles.telefone', exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='telefone'), true),
    ('0006 trigger z_sync_auth_user_verification', exists(select 1 from pg_trigger where tgname='z_sync_auth_user_verification'), true),
    ('0009 checklists.tecnico_nome', exists(select 1 from information_schema.columns where table_schema='public' and table_name='checklists' and column_name='tecnico_nome'), true),
    ('0010 checklist_itens.secao', exists(select 1 from information_schema.columns where table_schema='public' and table_name='checklist_itens' and column_name='secao'), true),
    ('0008 proteger_papel protege email_verificado', position('email_verificado' in pg_get_functiondef('public.proteger_papel()'::regprocedure)) > 0, true),
    ('0008 empresa_atual exige status ativa', position('ativa' in pg_get_functiondef('public.empresa_atual()'::regprocedure)) > 0, true),
    ('20260910235534 dashboard_configuracoes', to_regclass('public.dashboard_configuracoes') is not null, true),
    ('0011 ainda ausente (authenticated com TRUNCATE em convites)', has_table_privilege('authenticated','public.convites','TRUNCATE'), true),
    ('0012 ainda ausente (setores unique composto)', exists(select 1 from pg_constraint where conname='setores_id_cidade_id_empresa_id_key'), false),
    ('20260910230508 ainda ausente (idx_convites_criado_por)', exists(select 1 from pg_indexes where indexname='idx_convites_criado_por'), false),
    ('team_invites ainda ausente (convites.token_hash)', exists(select 1 from information_schema.columns where table_schema='public' and table_name='convites' and column_name='token_hash'), false),
    ('helpers com row_security=off (fix de produção)', (select bool_and(coalesce(proconfig,'{}') @> array['row_security=off']) from pg_proc where pronamespace='public'::regnamespace and proname in ('empresa_atual','eh_super_admin','pode_administrar_empresa','pode_gerir_cadastro','pode_operar')), true),
    ('nenhuma função admin_* de convites', not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'admin_%convite%'), true)
) as m(marcador, obtido, esperado);

-- 3) Preflight da 0012 (mesmas checagens da migration; todas precisam ser 0)
select '0012' as secao, relation, quantity, quantity = 0 as ok
from (
  select 'profiles.cidade_id -> cidades' as relation, count(*) as quantity
  from public.profiles p left join public.cidades c on c.id = p.cidade_id
  where p.cidade_id is not null and (c.id is null or p.empresa_id is distinct from c.empresa_id)
  union all
  select 'profiles.empresa_id NULL exige cidade_id NULL', count(*)
  from public.profiles p where p.empresa_id is null and p.cidade_id is not null
  union all
  select 'setores.cidade_id -> cidades', count(*)
  from public.setores s left join public.cidades c on c.id = s.cidade_id
  where c.id is null or s.empresa_id is distinct from c.empresa_id
  union all
  select 'equipamentos.cidade_id -> cidades', count(*)
  from public.equipamentos e left join public.cidades c on c.id = e.cidade_id
  where c.id is null or e.empresa_id is distinct from c.empresa_id
  union all
  select 'equipamentos.setor_id/cidade_id -> setores', count(*)
  from public.equipamentos e left join public.setores s on s.id = e.setor_id
  where e.setor_id is not null and (s.id is null or e.empresa_id is distinct from s.empresa_id or e.cidade_id is distinct from s.cidade_id)
  union all
  select 'checklists.equipamento_id -> equipamentos', count(*)
  from public.checklists cl left join public.equipamentos eq on eq.id = cl.equipamento_id
  where eq.id is null or cl.empresa_id is distinct from eq.empresa_id
  union all
  select 'checklists.responsavel_id -> profiles', count(*)
  from public.checklists cl left join public.profiles p on p.id = cl.responsavel_id
  where cl.responsavel_id is not null and (p.id is null or cl.empresa_id is distinct from p.empresa_id)
  union all
  select 'checklist_itens.checklist_id -> checklists', count(*)
  from public.checklist_itens ci left join public.checklists cl on cl.id = ci.checklist_id
  where cl.id is null or ci.empresa_id is distinct from cl.empresa_id
  union all
  select 'estoque.material_id -> materiais', count(*)
  from public.estoque es left join public.materiais m on m.id = es.material_id
  where m.id is null or es.empresa_id is distinct from m.empresa_id
  union all
  select 'estoque.cidade_id -> cidades', count(*)
  from public.estoque es left join public.cidades c on c.id = es.cidade_id
  where c.id is null or es.empresa_id is distinct from c.empresa_id
  union all
  select 'movimentacoes.material_id -> materiais', count(*)
  from public.movimentacoes mv left join public.materiais m on m.id = mv.material_id
  where m.id is null or mv.empresa_id is distinct from m.empresa_id
  union all
  select 'movimentacoes.cidade_id -> cidades', count(*)
  from public.movimentacoes mv left join public.cidades c on c.id = mv.cidade_id
  where c.id is null or mv.empresa_id is distinct from c.empresa_id
  union all
  select 'movimentacoes.equipamento_id -> equipamentos', count(*)
  from public.movimentacoes mv left join public.equipamentos eq on eq.id = mv.equipamento_id
  where mv.equipamento_id is not null and (eq.id is null or mv.empresa_id is distinct from eq.empresa_id)
  union all
  select 'movimentacoes.usuario_id -> profiles', count(*)
  from public.movimentacoes mv left join public.profiles p on p.id = mv.usuario_id
  where mv.usuario_id is not null and (p.id is null or mv.empresa_id is distinct from p.empresa_id)
  union all
  select 'pendencias.cidade_id -> cidades', count(*)
  from public.pendencias pe left join public.cidades c on c.id = pe.cidade_id
  where c.id is null or pe.empresa_id is distinct from c.empresa_id
  union all
  select 'pendencias.equipamento_id -> equipamentos', count(*)
  from public.pendencias pe left join public.equipamentos eq on eq.id = pe.equipamento_id
  where pe.equipamento_id is not null and (eq.id is null or pe.empresa_id is distinct from eq.empresa_id)
  union all
  select 'pendencias.responsavel_id -> profiles', count(*)
  from public.pendencias pe left join public.profiles p on p.id = pe.responsavel_id
  where pe.responsavel_id is not null and (p.id is null or pe.empresa_id is distinct from p.empresa_id)
) as checks
order by relation;

-- 4) Convites legados pendentes (só contagem): a team_invites mantém as linhas;
-- convites antigos sem token_hash continuam listáveis, mas só aceitam após reenvio.
select 'convites' as secao,
       count(*) filter (where aceito_em is null and expira_em > now()) as pendentes_validos,
       count(*) filter (where aceito_em is null and expira_em <= now()) as pendentes_expirados,
       count(*) filter (where aceito_em is not null) as aceitos
from public.convites;
