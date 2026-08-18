-- =========================================================================
-- Maintenex :: criar a conta de administração da plataforma
--
-- Basta executar: nada precisa ser editado.
-- O script gera uma senha forte e a exibe no resultado — copie, entre em
-- /login e troque a senha depois do primeiro acesso.
--
-- Para escolher a senha você mesmo, preencha senha_escolhida na linha 16.
-- Idempotente: rodando de novo, gera uma senha nova para a mesma conta.
-- =========================================================================

create extension if not exists pgcrypto;

do $$
declare
  senha_escolhida constant text := '';   -- deixe vazio para gerar automaticamente

  email_admin constant text := 'admin.tenex@maintenex.com.br';
  nome_admin  constant text := 'Administrador Maintenex';

  senha       text;
  id_usuario  uuid;
  ja_existia  boolean := false;
begin
  -- senha gerada: 18 caracteres de um alfabeto sem ambiguidade visual
  if length(coalesce(senha_escolhida, '')) >= 8 then
    senha := senha_escolhida;
  else
    select string_agg(
             substr('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%',
                    1 + floor(random() * 59)::integer, 1), '')
      into senha
    from generate_series(1, 18);
  end if;

  select id into id_usuario from auth.users where lower(email) = lower(email_admin);

  if id_usuario is not null then
    ja_existia := true;
    update auth.users
    set encrypted_password = crypt(senha, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = id_usuario;
  else
    id_usuario := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', id_usuario, 'authenticated', 'authenticated',
      lower(email_admin), crypt(senha, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', nome_admin),
      now(), now()
    );

    -- o GoTrue exige uma identidade de e-mail para permitir login por senha
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), id_usuario,
      jsonb_build_object('sub', id_usuario::text, 'email', lower(email_admin), 'email_verified', true),
      'email', lower(email_admin), now(), now(), now()
    );
  end if;

  -- o trigger handle_new_user cria o profile; aqui ele vira super_admin
  insert into profiles (id, nome, email, papel)
  values (id_usuario, nome_admin, lower(email_admin), 'super_admin')
  on conflict (id) do update
    set papel = 'super_admin', empresa_id = null, nome = excluded.nome, ativo = true;

  -- guarda a senha para o select final poder exibi-la uma única vez
  create temporary table if not exists credencial_admin (email text, senha text);
  delete from credencial_admin;
  insert into credencial_admin values (lower(email_admin), senha);

  raise notice '%', case when ja_existia then 'conta ja existia — senha redefinida'
                         else 'conta criada' end;
end $$;

-- >>> ANOTE A SENHA: ela não aparece de novo <<<
select email        as "e-mail",
       senha        as "senha (anote agora)",
       'super_admin' as "papel",
       'entre em /login e troque a senha em Configurações' as "proximo passo"
from credencial_admin;
