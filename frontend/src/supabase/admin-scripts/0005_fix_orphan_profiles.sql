-- =========================================================
-- Maintenex :: Correção de perfis órfãos
--
-- Este script diagnostica e corrige perfis sem empresa vinculada,
-- permitindo vincular usuários órfãos a empresas existentes.
-- =========================================================

-- ========================================
-- DIAGNÓSTICO
-- ========================================

-- 1) Listar todos os perfis órfãos (sem empresa_id)
select
  id,
  nome,
  email,
  papel,
  ativo,
  criado_em
from profiles
where empresa_id is null
  and papel != 'super_admin'
order by criado_em desc;

-- 2) Listar todas as empresas disponíveis
select
  id,
  nome,
  slug,
  email_principal,
  status,
  criado_em
from empresas
order by criado_em desc;

-- ========================================
-- CORREÇÃO
-- ========================================

-- Opção A: Vincular perfil órfão a uma empresa existente
-- Substitua os valores abaixo conforme necessário

-- Exemplo: vincular engenhariasoftware.yuri@gmail.com à primeira empresa ativa
do $$
declare
  usuario_email constant text := 'engenhariasoftware.yuri@gmail.com';
  empresa_escolhida uuid;
  usuario_id uuid;
begin
  -- Buscar ID do usuário
  select id into usuario_id
  from profiles
  where lower(email) = lower(usuario_email)
    and empresa_id is null
    and papel != 'super_admin'
  limit 1;

  if usuario_id is null then
    raise notice 'Usuário % não encontrado ou já possui empresa vinculada.', usuario_email;
    return;
  end if;

  -- Buscar primeira empresa ativa (ou ajuste a query conforme necessário)
  select id into empresa_escolhida
  from empresas
  where status = 'ativa'
  order by criado_em
  limit 1;

  if empresa_escolhida is null then
    raise notice 'Nenhuma empresa ativa encontrada. Criando empresa padrão...';

    -- Criar empresa se não existir
    insert into empresas (nome, slug, email_principal, status, criado_por)
    values (
      'Maintenex Demo',
      'maintenex-demo',
      usuario_email,
      'ativa',
      usuario_id
    )
    returning id into empresa_escolhida;

    raise notice 'Empresa criada: %', empresa_escolhida;
  end if;

  -- Vincular usuário à empresa como owner
  update profiles
  set empresa_id = empresa_escolhida,
      papel = 'owner'
  where id = usuario_id;

  raise notice 'Usuário % vinculado à empresa % com papel owner', usuario_email, empresa_escolhida;
end $$;

-- ========================================
-- VERIFICAÇÃO PÓS-CORREÇÃO
-- ========================================

-- Verificar se ainda existem perfis órfãos
select
  count(*) as perfis_orfaos_restantes
from profiles
where empresa_id is null
  and papel != 'super_admin';

-- Verificar o perfil corrigido
select
  p.id,
  p.nome,
  p.email,
  p.papel,
  p.empresa_id,
  e.nome as empresa_nome,
  e.slug as empresa_slug
from profiles p
left join empresas e on e.id = p.empresa_id
where lower(p.email) = lower('engenhariasoftware.yuri@gmail.com');
