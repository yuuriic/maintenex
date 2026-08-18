-- =========================================================================
-- Maintenex :: criar a conta de administração da plataforma
--
-- Cria o usuário direto no banco, com e-mail já confirmado. Serve quando o
-- domínio ainda não tem registro MX (a API de cadastro recusa esses e-mails).
--
-- ANTES DE RODAR: troque a senha na constante senha_admin abaixo.
-- Idempotente: se a conta já existir, apenas promove a super_admin.
-- =========================================================================

do $$
declare
  -- >>> ajuste estes dois valores <<<
  email_admin constant text := 'admin.tenex@maintenex.com.br';
  senha_admin constant text := 'TROQUE-ESTA-SENHA';

  nome_admin  constant text := 'Administrador Maintenex';
  id_usuario  uuid;
  ja_existia  boolean := false;
begin
  if senha_admin = 'TROQUE-ESTA-SENHA' then
    raise exception 'Defina uma senha real em senha_admin antes de executar.';
  end if;
  if length(senha_admin) < 8 then
    raise exception 'Use uma senha com pelo menos 8 caracteres.';
  end if;

  select id into id_usuario from auth.users where lower(email) = lower(email_admin);

  if id_usuario is not null then
    ja_existia := true;
    -- conta existente: apenas atualiza a senha e garante o e-mail confirmado
    update auth.users
    set encrypted_password = crypt(senha_admin, gen_salt('bf')),
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
      lower(email_admin), crypt(senha_admin, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', nome_admin),
      now(), now()
    );

    -- o GoTrue exige uma identidade de e-mail para permitir o login
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), id_usuario,
      jsonb_build_object('sub', id_usuario::text, 'email', lower(email_admin), 'email_verified', true),
      'email', lower(email_admin), now(), now(), now()
    );
  end if;

  -- o trigger handle_new_user já criou o profile; aqui ele vira super_admin
  insert into profiles (id, nome, email, papel)
  values (id_usuario, nome_admin, lower(email_admin), 'super_admin')
  on conflict (id) do update
    set papel = 'super_admin', empresa_id = null, nome = excluded.nome, ativo = true;

  raise notice '--------------------------------------------';
  if ja_existia then
    raise notice 'conta ja existia — senha redefinida e papel garantido';
  else
    raise notice 'conta criada';
  end if;
  raise notice 'email .... %', lower(email_admin);
  raise notice 'papel .... super_admin (enxerga e administra todas as empresas)';
  raise notice 'entre em /login e troque a senha depois do primeiro acesso';
  raise notice '--------------------------------------------';
end $$;

select email, papel::text as papel, empresa_id, ativo from profiles order by papel, email;
