-- Hardening de autorização multi-tenant.
-- Aplicar no Supabase antes de considerar empresas suspensas/canceladas bloqueadas.

-- Uma empresa fora do estado ativo não conserva acesso aos dados operacionais.
create or replace function public.empresa_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.empresa_id
  from public.profiles p
  join public.empresas e on e.id = p.empresa_id
  where p.id = auth.uid()
    and p.ativo
    and e.status = 'ativa'
$$;

-- Um usuário pode editar seus campos de apresentação, mas não pode reativar
-- a própria conta nem sobrescrever dados sincronizados pelo Supabase Auth.
create or replace function public.proteger_papel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meu_papel papel_usuario;
  minha_empresa uuid;
begin
  select papel, empresa_id into meu_papel, minha_empresa
  from public.profiles
  where id = auth.uid();

  if auth.uid() is null then
    return new;
  end if;

  if meu_papel = 'super_admin' then
    return new;
  end if;

  if new.id = auth.uid() and (
    new.papel is distinct from old.papel
    or new.empresa_id is distinct from old.empresa_id
    or new.ativo is distinct from old.ativo
    or new.email is distinct from old.email
    or new.telefone is distinct from old.telefone
    or new.email_verificado is distinct from old.email_verificado
    or new.criado_em is distinct from old.criado_em
  ) then
    raise exception 'Você não pode alterar campos protegidos do próprio perfil.';
  end if;

  if new.papel = 'super_admin' and old.papel is distinct from 'super_admin' then
    raise exception 'Somente a administração da plataforma concede o papel super_admin.';
  end if;

  if meu_papel = 'owner' then
    if new.empresa_id is distinct from minha_empresa or old.empresa_id is distinct from minha_empresa then
      raise exception 'Você só administra usuários da sua própria empresa.';
    end if;
    return new;
  end if;

  if new.papel is distinct from old.papel or new.empresa_id is distinct from old.empresa_id then
    raise exception 'Sem permissão para alterar papel ou empresa.';
  end if;

  return new;
end;
$$;

-- Funções de trigger não são endpoints RPC. Helpers usados pelas políticas
-- permanecem executáveis apenas por usuários autenticados.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.aplicar_movimentacao() from public, anon, authenticated;
revoke all on function public.proteger_papel() from public, anon, authenticated;
revoke all on function public.proteger_convite() from public, anon, authenticated;

revoke all on function public.empresa_atual() from public, anon;
revoke all on function public.eh_super_admin() from public, anon;
revoke all on function public.pode_administrar_empresa() from public, anon;
revoke all on function public.pode_gerir_cadastro() from public, anon;
revoke all on function public.pode_operar() from public, anon;

grant execute on function public.empresa_atual() to authenticated;
grant execute on function public.eh_super_admin() to authenticated;
grant execute on function public.pode_administrar_empresa() to authenticated;
grant execute on function public.pode_gerir_cadastro() to authenticated;
grant execute on function public.pode_operar() to authenticated;
