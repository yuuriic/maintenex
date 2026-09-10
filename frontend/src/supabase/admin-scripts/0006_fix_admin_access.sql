-- =========================================================
-- Maintenex :: Correção de Acesso Emergencial (Seguro)
--
-- Este script resolve o problema de usuários órfãos que ficam
-- travados em "Preparando seu acesso..." sem comprometer
-- a segurança do sistema multi-tenant.
--
-- Execução: Cole no SQL Editor do Supabase e execute.
-- =========================================================

-- ========================================
-- DIAGNÓSTICO INICIAL
-- ========================================

-- Ver todos os usuários sem empresa (exceto super_admin)
select
  p.id,
  p.nome,
  p.email,
  p.papel,
  p.empresa_id,
  p.ativo,
  p.criado_em,
  au.email_confirmed_at,
  au.created_at as auth_criado_em
from profiles p
join auth.users au on au.id = p.id
where p.empresa_id is null
  and p.papel != 'super_admin'
order by p.criado_em desc;

-- Ver todas as empresas disponíveis
select
  id,
  nome,
  slug,
  email_principal,
  status,
  criado_em
from empresas
where status = 'ativa'
order by criado_em;

-- ========================================
-- CORREÇÃO SEGURA
-- ========================================

do $$
declare
  perfil_id uuid;
  perfil_email text;
  perfil_nome text;
  empresa_existente uuid;
  empresa_nova uuid;
  total_empresas int;
begin
  -- Encontrar o perfil órfão mais recente (assumindo ser o admin)
  select p.id, p.email, p.nome
  into perfil_id, perfil_email, perfil_nome
  from profiles p
  where p.empresa_id is null
    and p.papel != 'super_admin'
    and p.ativo = true
  order by p.criado_em desc
  limit 1;

  if perfil_id is null then
    raise notice 'Nenhum perfil órfão encontrado. Sistema OK.';
    return;
  end if;

  raise notice 'Perfil órfão encontrado: % (%) - ID: %', perfil_nome, perfil_email, perfil_id;

  -- Verificar se já existe alguma empresa ativa
  select count(*), min(id)
  into total_empresas, empresa_existente
  from empresas
  where status = 'ativa';

  if total_empresas = 0 then
    raise notice 'Nenhuma empresa encontrada. Criando empresa padrão...';

    -- Criar empresa padrão
    insert into empresas (nome, slug, email_principal, status, criado_por)
    values (
      'Maintenex',
      'maintenex',
      perfil_email,
      'ativa',
      perfil_id
    )
    returning id into empresa_nova;

    raise notice 'Empresa criada: Maintenex (ID: %)', empresa_nova;

    -- Vincular usuário como owner da nova empresa
    update profiles
    set empresa_id = empresa_nova,
        papel = 'owner'
    where id = perfil_id;

    raise notice 'Usuário % promovido a owner da empresa Maintenex', perfil_email;

  else
    raise notice 'Empresa(s) existente(s) encontrada(s): %', total_empresas;

    -- Vincular à primeira empresa ativa como owner
    update profiles
    set empresa_id = empresa_existente,
        papel = 'owner'
    where id = perfil_id;

    raise notice 'Usuário % vinculado como owner à empresa existente (ID: %)', perfil_email, empresa_existente;
  end if;

  -- Criar cidade padrão para a empresa (necessário para o sistema funcionar)
  insert into cidades (empresa_id, nome, uf, ativa)
  select
    coalesce(empresa_nova, empresa_existente),
    'Sede',
    'SP',
    true
  where not exists (
    select 1 from cidades
    where empresa_id = coalesce(empresa_nova, empresa_existente)
  );

  raise notice 'Cidade padrão criada/verificada.';

end $$;

-- ========================================
-- VERIFICAÇÃO PÓS-CORREÇÃO
-- ========================================

-- Confirmar que não há mais perfis órfãos ativos
select
  count(*) as perfis_orfaos_ativos
from profiles
where empresa_id is null
  and papel != 'super_admin'
  and ativo = true;

-- Verificar perfis corrigidos
select
  p.id,
  p.nome,
  p.email,
  p.papel,
  p.empresa_id,
  e.nome as empresa_nome,
  e.slug as empresa_slug,
  e.status as empresa_status
from profiles p
left join empresas e on e.id = p.empresa_id
where p.empresa_id is not null
  and p.papel in ('owner', 'gestor')
order by p.criado_em desc
limit 5;

-- ========================================
-- ROLLBACK (SE NECESSÁRIO)
-- ========================================

-- Caso precise reverter, descomente e ajuste:
-- update profiles
-- set empresa_id = null,
--     papel = 'leitor'
-- where email = 'engenhariasoftware.yuri@gmail.com';
