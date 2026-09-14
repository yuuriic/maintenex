-- Convites de equipe server-side, tokenizados e com status de envio.
-- Resend é acionado apenas pela Edge Function; o navegador mantém leitura via RLS.

begin;

alter table public.convites
  add column if not exists token_hash text,
  add column if not exists status_envio text not null default 'pendente',
  add column if not exists tentativas_envio integer not null default 0,
  add column if not exists enviado_em timestamptz,
  add column if not exists reenviado_em timestamptz,
  add column if not exists ultimo_erro_envio text,
  add column if not exists ultimo_id_envio text,
  add column if not exists atualizado_em timestamptz not null default now();

alter table public.convites
  drop constraint if exists convites_status_envio_check;

alter table public.convites
  add constraint convites_status_envio_check
  check (status_envio in ('pendente', 'enviado', 'dry_run', 'falhou'));

alter table public.convites
  drop constraint if exists convites_tentativas_envio_check;

alter table public.convites
  add constraint convites_tentativas_envio_check
  check (tentativas_envio >= 0);

create unique index if not exists idx_convites_token_hash
  on public.convites (token_hash)
  where token_hash is not null;

create index if not exists idx_convites_empresa_criado
  on public.convites (empresa_id, criado_em desc);

create or replace function public.convite_atualizar_data()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.atualizado_em = now();
  new.email = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists convite_atualizado_em on public.convites;
create trigger convite_atualizado_em
before insert or update on public.convites
for each row execute function public.convite_atualizar_data();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  nome_empresa text := nullif(trim(new.raw_user_meta_data->>'empresa_nome'), '');
  nome_usuario text := coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1));
  convite convites%rowtype;
  empresa empresas%rowtype;
  base_slug text;
  slug_final text;
  sufixo integer := 0;
  convite_token text := nullif(trim(new.raw_user_meta_data->>'convite_token'), '');
begin
  -- 1) convite tokenizado pendente tem prioridade. Convites legados sem token
  -- não vinculam mais usuários automaticamente; gere um novo link por reenvio.
  if convite_token is not null then
    select c.* into convite
    from convites c
    join empresas e on e.id = c.empresa_id and e.status = 'ativa'
    where lower(c.email) = lower(new.email)
      and c.token_hash = encode(digest(convite_token, 'sha256'), 'hex')
      and c.aceito_em is null
      and c.expira_em > now()
    order by c.criado_em desc
    limit 1;

    if found then
      insert into profiles (id, empresa_id, nome, email, papel)
      values (new.id, convite.empresa_id, nome_usuario, new.email, convite.papel)
      on conflict (id) do update
        set empresa_id = excluded.empresa_id,
            nome = excluded.nome,
            email = excluded.email,
            papel = excluded.papel;

      update convites
      set aceito_em = now()
      where id = convite.id;
      return new;
    end if;
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
      set empresa_id = excluded.empresa_id,
          nome = excluded.nome,
          email = excluded.email,
          papel = excluded.papel;
    return new;
  end if;

  -- 3) sem convite válido e sem empresa -> profile órfão
  insert into profiles (id, nome, email, papel)
  values (new.id, nome_usuario, new.email, 'leitor')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.admin_preparar_convite_equipe(
  p_actor_id uuid,
  p_email text,
  p_papel papel_usuario,
  p_token_hash text,
  p_empresa_id uuid default null,
  p_convite_id uuid default null
)
returns table (
  status text,
  convite_id uuid,
  empresa_id uuid,
  email text,
  papel papel_usuario,
  empresa_nome text,
  convidado_nome text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor profiles%rowtype;
  alvo_email text := lower(trim(p_email));
  alvo_empresa empresas%rowtype;
  existente_user_id uuid;
  existente_nome text;
  existente_empresa uuid;
  convite_existente convites%rowtype;
begin
  select * into actor
  from public.profiles
  where id = p_actor_id and ativo;

  if actor.id is null then
    raise exception 'Usuário sem permissão para enviar convites.' using errcode = 'P0001';
  end if;

  if actor.papel not in ('owner', 'super_admin') then
    raise exception 'Somente responsáveis da empresa enviam convites.' using errcode = 'P0001';
  end if;

  if p_papel = 'super_admin' then
    raise exception 'Convite não pode conceder o papel super_admin.' using errcode = 'P0001';
  end if;

  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'Token de convite inválido.' using errcode = 'P0001';
  end if;

  if p_convite_id is not null then
    select * into convite_existente
    from public.convites c
    where c.id = p_convite_id;

    if convite_existente.id is null then
      raise exception 'Convite não encontrado.' using errcode = 'P0001';
    end if;

    alvo_email := lower(trim(convite_existente.email));
    empresa_id := convite_existente.empresa_id;
    papel := convite_existente.papel;
  else
    if alvo_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Informe um e-mail válido.' using errcode = 'P0001';
    end if;

    empresa_id := case
      when actor.papel = 'super_admin' then coalesce(p_empresa_id, actor.empresa_id)
      else actor.empresa_id
    end;
    papel := p_papel;
  end if;

  if empresa_id is null then
    raise exception 'Selecione uma empresa ativa para enviar o convite.' using errcode = 'P0001';
  end if;

  if actor.papel <> 'super_admin' and empresa_id is distinct from actor.empresa_id then
    raise exception 'Você só convida para a sua própria empresa.' using errcode = 'P0001';
  end if;

  select * into alvo_empresa
  from public.empresas e
  where e.id = empresa_id and e.status = 'ativa';

  if alvo_empresa.id is null then
    raise exception 'Empresa inativa ou não encontrada.' using errcode = 'P0001';
  end if;

  select u.id,
         coalesce(nullif(trim(u.raw_user_meta_data->>'nome'), ''), split_part(u.email, '@', 1)),
         p.empresa_id
  into existente_user_id, existente_nome, existente_empresa
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = alvo_email
  order by u.created_at desc
  limit 1;

  if existente_empresa = empresa_id then
    return query select 'ja_membro'::text, null::uuid, empresa_id, alvo_email, papel, alvo_empresa.nome, existente_nome;
    return;
  end if;

  if existente_empresa is not null and existente_empresa is distinct from empresa_id then
    raise exception 'Este e-mail já pertence a outra empresa.' using errcode = 'P0001';
  end if;

  -- Serializa envios concorrentes do mesmo convite e impõe intervalo mínimo entre envios.
  select * into convite_existente
  from public.convites c
  where c.empresa_id = admin_preparar_convite_equipe.empresa_id and lower(c.email) = alvo_email
  for update;

  if convite_existente.id is not null
     and convite_existente.status_envio in ('enviado', 'dry_run')
     and greatest(coalesce(convite_existente.enviado_em, '-infinity'), coalesce(convite_existente.reenviado_em, '-infinity')) > now() - interval '1 minute' then
    raise exception 'Aguarde um minuto antes de reenviar este convite.' using errcode = 'P0001';
  end if;

  insert into public.convites (
    empresa_id,
    email,
    papel,
    criado_por,
    aceito_em,
    expira_em,
    token_hash,
    status_envio,
    ultimo_erro_envio,
    ultimo_id_envio
  )
  values (
    empresa_id,
    alvo_email,
    papel,
    actor.id,
    null,
    now() + interval '14 days',
    p_token_hash,
    'pendente',
    null,
    null
  )
  on conflict on constraint convites_empresa_id_email_key do update
    set papel = excluded.papel,
        criado_por = excluded.criado_por,
        aceito_em = null,
        expira_em = excluded.expira_em,
        token_hash = excluded.token_hash,
        status_envio = 'pendente',
        ultimo_erro_envio = null,
        ultimo_id_envio = null,
        reenviado_em = case when public.convites.token_hash is null then public.convites.reenviado_em else now() end
  returning public.convites.* into convite_existente;

  return query select 'preparado'::text, convite_existente.id, convite_existente.empresa_id, convite_existente.email,
    convite_existente.papel, alvo_empresa.nome, existente_nome;
end;
$$;

create or replace function public.admin_marcar_envio_convite(
  p_convite_id uuid,
  p_status text,
  p_send_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('enviado', 'dry_run', 'falhou') then
    raise exception 'Status de envio inválido.' using errcode = 'P0001';
  end if;

  update public.convites
  set status_envio = p_status,
      tentativas_envio = tentativas_envio + 1,
      enviado_em = case when p_status in ('enviado', 'dry_run') then coalesce(enviado_em, now()) else enviado_em end,
      reenviado_em = case when tentativas_envio > 0 and p_status in ('enviado', 'dry_run') then now() else reenviado_em end,
      ultimo_id_envio = p_send_id,
      ultimo_erro_envio = case when p_status = 'falhou' then nullif(left(coalesce(p_error, 'Falha no envio.'), 500), '') else null end
  where id = p_convite_id;

  if not found then
    raise exception 'Convite não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_aceitar_convite_equipe(
  p_user_id uuid,
  p_token text
)
returns table (
  status text,
  convite_id uuid,
  empresa_id uuid,
  email text,
  papel papel_usuario,
  empresa_nome text
)
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  usuario auth.users%rowtype;
  convite convites%rowtype;
  perfil profiles%rowtype;
  empresa empresas%rowtype;
  nome_usuario text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    raise exception 'Link de convite inválido.' using errcode = 'P0001';
  end if;

  select * into usuario
  from auth.users
  where id = p_user_id;

  if usuario.id is null then
    raise exception 'Usuário autenticado não encontrado.' using errcode = 'P0001';
  end if;

  select * into convite
  from public.convites c
  where c.token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and lower(c.email) = lower(usuario.email)
    and c.aceito_em is null
    and c.expira_em > now()
  order by c.criado_em desc
  limit 1;

  if convite.id is null then
    raise exception 'Convite inválido, expirado ou já aceito.' using errcode = 'P0001';
  end if;

  select * into empresa
  from public.empresas e
  where e.id = convite.empresa_id and e.status = 'ativa';

  if empresa.id is null then
    raise exception 'Empresa inativa ou não encontrada.' using errcode = 'P0001';
  end if;

  select * into perfil
  from public.profiles
  where id = usuario.id;

  if perfil.empresa_id is not null and perfil.empresa_id is distinct from convite.empresa_id then
    raise exception 'Este usuário já pertence a outra empresa.' using errcode = 'P0001';
  end if;

  nome_usuario := coalesce(nullif(trim(usuario.raw_user_meta_data->>'nome'), ''), split_part(usuario.email, '@', 1));

  insert into public.profiles (id, empresa_id, nome, email, papel)
  values (usuario.id, convite.empresa_id, nome_usuario, usuario.email, convite.papel)
  on conflict (id) do update
    set empresa_id = excluded.empresa_id,
        nome = coalesce(nullif(public.profiles.nome, ''), excluded.nome),
        email = excluded.email,
        papel = excluded.papel,
        ativo = true;

  update public.convites
  set aceito_em = now()
  where id = convite.id;

  return query select 'aceito'::text, convite.id, convite.empresa_id, convite.email, convite.papel, empresa.nome;
end;
$$;

create or replace function public.admin_cancelar_convite_equipe(
  p_actor_id uuid,
  p_convite_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor profiles%rowtype;
  convite convites%rowtype;
begin
  select * into actor
  from public.profiles
  where id = p_actor_id and ativo;

  if actor.id is null or actor.papel not in ('owner', 'super_admin') then
    raise exception 'Somente responsáveis da empresa removem convites.' using errcode = 'P0001';
  end if;

  select * into convite
  from public.convites
  where id = p_convite_id;

  if convite.id is null then
    raise exception 'Convite não encontrado.' using errcode = 'P0001';
  end if;

  if actor.papel <> 'super_admin' and convite.empresa_id is distinct from actor.empresa_id then
    raise exception 'Você só remove convites da sua própria empresa.' using errcode = 'P0001';
  end if;

  if convite.aceito_em is not null then
    raise exception 'Convites já aceitos não podem ser removidos.' using errcode = 'P0001';
  end if;

  delete from public.convites
  where id = p_convite_id;
end;
$$;

alter table public.convites enable row level security;
drop policy if exists "convite_admin" on public.convites;
drop policy if exists "convite_select" on public.convites;
drop policy if exists "convite_insert" on public.convites;
drop policy if exists "convite_update" on public.convites;
drop policy if exists "convite_delete" on public.convites;

create policy "convite_select" on public.convites
  for select to authenticated
  using ((empresa_id = public.empresa_atual() and public.pode_administrar_empresa()) or public.eh_super_admin());

revoke insert, update, delete, truncate, references, trigger, maintain on table public.convites from authenticated;
grant select on table public.convites to authenticated;

revoke all on function public.convite_atualizar_data() from public, anon, authenticated;
revoke all on function public.admin_preparar_convite_equipe(uuid, text, papel_usuario, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_marcar_envio_convite(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_aceitar_convite_equipe(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_cancelar_convite_equipe(uuid, uuid) from public, anon, authenticated;

grant execute on function public.admin_preparar_convite_equipe(uuid, text, papel_usuario, text, uuid, uuid) to service_role;
grant execute on function public.admin_marcar_envio_convite(uuid, text, text, text) to service_role;
grant execute on function public.admin_aceitar_convite_equipe(uuid, text) to service_role;
grant execute on function public.admin_cancelar_convite_equipe(uuid, uuid) to service_role;

commit;
