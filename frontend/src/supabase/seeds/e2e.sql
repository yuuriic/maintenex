-- =========================================================
-- Maintenex :: usuários locais E2E (idempotente e reproduzível)
--
-- Seed local apenas para Supabase CLI. Não contém dados de produção.
-- Credenciais determinísticas:
--   e2e-owner@example.test   / MaintenexE2E!123
--   e2e-gestor@example.test  / MaintenexE2E!123
--   e2e-tecnico@example.test / MaintenexE2E!123
--   e2e-leitor@example.test  / MaintenexE2E!123
-- =========================================================

create extension if not exists "pgcrypto";

do $$
declare
  e2e_empresa_id constant uuid := '00000000-0000-4000-8000-000000000001';
  e2e_cidade_id uuid;
  e2e_setor_id uuid;
  bcrypt_salt constant text := '$2a$10$abcdefghijklmnopqrstuu';
  fixed_now constant timestamptz := '2026-01-01 00:00:00+00';
begin
  insert into empresas (id, nome, slug, email_principal, status, criado_em)
  values (
    e2e_empresa_id,
    'Maintenex E2E Local',
    'maintenex-e2e-local',
    'e2e-owner@example.test',
    'ativa',
    fixed_now
  )
  on conflict (id) do update
    set nome = excluded.nome,
        slug = excluded.slug,
        email_principal = excluded.email_principal,
        status = excluded.status;

  delete from auth.users
  where lower(email) in (
    'e2e-owner@example.test',
    'e2e-gestor@example.test',
    'e2e-tecnico@example.test',
    'e2e-leitor@example.test'
  )
  and id not in (
    '00000000-0000-4000-8000-000000000101'::uuid,
    '00000000-0000-4000-8000-000000000102'::uuid,
    '00000000-0000-4000-8000-000000000103'::uuid,
    '00000000-0000-4000-8000-000000000104'::uuid
  );

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  select
    seeded.id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    seeded.email,
    crypt('MaintenexE2E!123', bcrypt_salt),
    fixed_now,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', seeded.nome, 'e2e', true),
    fixed_now,
    fixed_now,
    '',
    '',
    '',
    ''
  from (values
    ('00000000-0000-4000-8000-000000000101'::uuid, 'e2e-owner@example.test',   'E2E Owner'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'e2e-gestor@example.test',  'E2E Gestor'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'e2e-tecnico@example.test', 'E2E Técnico'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'e2e-leitor@example.test',  'E2E Leitor')
  ) as seeded(id, email, nome)
  on conflict (id) do update
    set email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        email_confirmed_at = excluded.email_confirmed_at,
        raw_app_meta_data = excluded.raw_app_meta_data,
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = fixed_now,
        role = excluded.role,
        aud = excluded.aud;

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    created_at,
    updated_at,
    last_sign_in_at
  )
  select
    seeded.identity_id,
    seeded.user_id,
    seeded.user_id::text,
    jsonb_build_object('sub', seeded.user_id::text, 'email', seeded.email, 'email_verified', true),
    'email',
    fixed_now,
    fixed_now,
    fixed_now
  from (values
    ('00000000-0000-4000-8000-000000000201'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, 'e2e-owner@example.test'),
    ('00000000-0000-4000-8000-000000000202'::uuid, '00000000-0000-4000-8000-000000000102'::uuid, 'e2e-gestor@example.test'),
    ('00000000-0000-4000-8000-000000000203'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, 'e2e-tecnico@example.test'),
    ('00000000-0000-4000-8000-000000000204'::uuid, '00000000-0000-4000-8000-000000000104'::uuid, 'e2e-leitor@example.test')
  ) as seeded(identity_id, user_id, email)
  on conflict (provider, provider_id) do update
    set user_id = excluded.user_id,
        identity_data = excluded.identity_data,
        updated_at = fixed_now,
        last_sign_in_at = fixed_now;

  insert into profiles (id, empresa_id, nome, email, papel, ativo, criado_em)
  select seeded.id, e2e_empresa_id, seeded.nome, seeded.email, seeded.papel, true, fixed_now
  from (values
    ('00000000-0000-4000-8000-000000000101'::uuid, 'E2E Owner',   'e2e-owner@example.test',   'owner'::papel_usuario),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'E2E Gestor',  'e2e-gestor@example.test',  'gestor'::papel_usuario),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'E2E Técnico', 'e2e-tecnico@example.test', 'tecnico'::papel_usuario),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'E2E Leitor',  'e2e-leitor@example.test',  'leitor'::papel_usuario)
  ) as seeded(id, nome, email, papel)
  on conflict (id) do update
    set empresa_id = excluded.empresa_id,
        nome = excluded.nome,
        email = excluded.email,
        papel = excluded.papel,
        ativo = excluded.ativo;

  insert into cidades (id, empresa_id, nome, uf, ativa, criado_em)
  values (
    '00000000-0000-4000-8000-000000000301'::uuid,
    e2e_empresa_id,
    'Cidade E2E Local',
    'SP',
    true,
    fixed_now
  )
  on conflict (empresa_id, nome, uf) do update
    set ativa = excluded.ativa
  returning id into e2e_cidade_id;

  insert into setores (id, empresa_id, cidade_id, nome, responsavel, criado_em)
  values (
    '00000000-0000-4000-8000-000000000302'::uuid,
    e2e_empresa_id,
    e2e_cidade_id,
    'Setor E2E Local',
    'E2E Técnico',
    fixed_now
  )
  on conflict (cidade_id, nome) do update
    set empresa_id = excluded.empresa_id,
        responsavel = excluded.responsavel
  returning id into e2e_setor_id;

  insert into equipamentos (
    id,
    empresa_id,
    cidade_id,
    setor_id,
    codigo,
    nome,
    marca,
    modelo,
    numero_serie,
    localizacao,
    status,
    contador,
    criado_em
  )
  values (
    '00000000-0000-4000-8000-000000000303'::uuid,
    e2e_empresa_id,
    e2e_cidade_id,
    e2e_setor_id,
    'E2E-CHK-001',
    'Equipamento Checklist E2E',
    'Maintenex',
    'Checklist Local',
    'E2E-LOCAL-CHK-001',
    'Cidade E2E Local / Setor E2E Local',
    'ativo'::status_equipamento,
    0,
    fixed_now
  )
  on conflict (empresa_id, codigo) do update
    set cidade_id = excluded.cidade_id,
        setor_id = excluded.setor_id,
        nome = excluded.nome,
        marca = excluded.marca,
        modelo = excluded.modelo,
        numero_serie = excluded.numero_serie,
        localizacao = excluded.localizacao,
        status = excluded.status,
        contador = excluded.contador;

  insert into materiais (id, empresa_id, codigo, nome, categoria, unidade, estoque_minimo, criado_em)
  values (
    '00000000-0000-4000-8000-000000000304'::uuid,
    e2e_empresa_id,
    'E2E-EST-001',
    'Material Estoque E2E',
    'E2E',
    'un',
    0,
    fixed_now
  )
  on conflict (empresa_id, codigo) do update
    set nome = excluded.nome,
        categoria = excluded.categoria,
        unidade = excluded.unidade,
        estoque_minimo = excluded.estoque_minimo;
end $$;
