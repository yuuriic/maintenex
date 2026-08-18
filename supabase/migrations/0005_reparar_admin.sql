-- =========================================================================
-- Maintenex :: diagnosticar e reparar a conta de administração
--
-- O login da conta criada por SQL responde "Database error querying schema"
-- quando alguma coluna que o GoTrue lê como texto está NULL. Este script
-- compara a conta com uma criada pela API e corrige as diferenças.
--
-- Basta executar. Ao final mostra o diagnóstico e a senha nova.
-- =========================================================================

do $$
declare
  email_admin constant text := 'admin.tenex@maintenex.com.br';
  id_admin    uuid;
  senha_nova  text;
  coluna      text;
  corrigidas  text[] := '{}';
  valor       text;
begin
  select id into id_admin from auth.users where lower(email) = lower(email_admin);
  if id_admin is null then
    raise exception 'conta % não existe — rode 0004_criar_super_admin.sql antes', email_admin;
  end if;

  -- 1. toda coluna de texto anulável precisa de string vazia, nunca NULL
  for coluna in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'auth' and c.table_name = 'users'
      and c.data_type in ('character varying', 'text')
      and c.column_name not in ('email', 'phone', 'encrypted_password')
  loop
    execute format('select (to_jsonb(u) ->> %L) is null from auth.users u where u.id = %L',
                   coluna, id_admin) into valor;
    if valor = 'true' then
      execute format('update auth.users set %I = %L where id = %L', coluna, '', id_admin);
      corrigidas := corrigidas || coluna;
    end if;
  end loop;

  -- 2. campos que o GoTrue exige preenchidos
  update auth.users
  set instance_id  = coalesce(instance_id, '00000000-0000-0000-0000-000000000000'),
      aud          = coalesce(nullif(aud, ''), 'authenticated'),
      role         = coalesce(nullif(role, ''), 'authenticated'),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      created_at   = coalesce(created_at, now()),
      updated_at   = now(),
      raw_app_meta_data  = coalesce(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb),
      is_sso_user  = coalesce(is_sso_user, false),
      is_anonymous = coalesce(is_anonymous, false)
  where id = id_admin;

  -- 3. o login por senha exige uma identidade de e-mail
  if not exists (select 1 from auth.identities where user_id = id_admin and provider = 'email') then
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), id_admin,
      jsonb_build_object('sub', id_admin::text, 'email', lower(email_admin), 'email_verified', true),
      'email', lower(email_admin), now(), now(), now()
    );
    corrigidas := corrigidas || 'auth.identities (criada)';
  end if;

  -- 4. senha nova
  select string_agg(
           substr('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789',
                  1 + floor(random() * 56)::integer, 1), '')
    into senha_nova
  from generate_series(1, 16);

  update auth.users
  set encrypted_password = crypt(senha_nova, gen_salt('bf')), updated_at = now()
  where id = id_admin;

  -- 5. papel de plataforma
  insert into profiles (id, nome, email, papel)
  values (id_admin, 'Administrador Maintenex', lower(email_admin), 'super_admin')
  on conflict (id) do update
    set papel = 'super_admin', empresa_id = null, ativo = true;

  create temporary table if not exists reparo_admin (email text, senha text, corrigido text);
  delete from reparo_admin;
  insert into reparo_admin values (
    lower(email_admin), senha_nova,
    case when array_length(corrigidas, 1) is null
         then 'nada estava nulo'
         else array_to_string(corrigidas, ', ') end
  );
end $$;

select email                as "e-mail",
       senha                as "senha nova (anote)",
       corrigido            as "campos corrigidos"
from reparo_admin;
