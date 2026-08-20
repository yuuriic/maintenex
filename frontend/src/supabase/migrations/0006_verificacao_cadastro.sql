-- Estado de verificação do cadastro. O Supabase Auth continua sendo a fonte
-- de verdade; o perfil espelha o estado para as regras e para a interface.
alter table public.profiles
  add column if not exists telefone text,
  add column if not exists email_verificado boolean not null default false;

create index if not exists idx_profiles_telefone on public.profiles (telefone);

create or replace function public.sincronizar_verificacao_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set telefone = nullif(trim(new.raw_user_meta_data->>'telefone'), ''),
      email_verificado = new.email_confirmed_at is not null
  where id = new.id;
  return new;
end;
$$;

revoke all on function public.sincronizar_verificacao_usuario() from public, anon, authenticated;

drop trigger if exists z_sync_auth_user_verification on auth.users;
create trigger z_sync_auth_user_verification
  after insert or update of email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function public.sincronizar_verificacao_usuario();

-- Sincroniza cadastros existentes quando a migration for aplicada.
update public.profiles p
set telefone = nullif(trim(u.raw_user_meta_data->>'telefone'), ''),
    email_verificado = u.email_confirmed_at is not null
from auth.users u
where u.id = p.id;
