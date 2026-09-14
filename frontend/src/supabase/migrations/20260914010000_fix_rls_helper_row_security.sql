-- Fix de recursão de RLS nas helpers usadas pelas policies.
--
-- Produção recebeu este ajuste fora do repositório (history remoto
-- `20260910232221_fix_rls_helper_functions_recursion`). As helpers SECURITY
-- DEFINER leem `profiles`/`empresas`, tabelas que possuem policies que, por sua
-- vez, chamam as próprias helpers. Com `row_security = off` a leitura interna
-- ignora RLS (a função já roda como owner) e a recursão desaparece.
--
-- Esta migration só reescreve as cinco helpers preservando assinatura, corpo,
-- SECURITY DEFINER e search_path, adicionando `set row_security = off`.
-- Nenhum grant/revoke é alterado. Deve ficar DEPOIS de qualquer migration que
-- redefina essas funções (0008 e 20260910230508), para que o estado final as
-- mantenha com row_security desligado.

create or replace function public.empresa_atual()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p.empresa_id
  from public.profiles p
  join public.empresas e on e.id = p.empresa_id
  where p.id = auth.uid()
    and p.ativo
    and e.status = 'ativa'
$$;

create or replace function public.eh_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce((select papel = 'super_admin' and ativo from profiles where id = auth.uid()), false)
$$;

create or replace function public.pode_administrar_empresa()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce((select papel in ('super_admin', 'owner') and ativo from profiles where id = auth.uid()), false)
$$;

create or replace function public.pode_gerir_cadastro()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce((select papel in ('super_admin', 'owner', 'gestor') and ativo from profiles where id = auth.uid()), false)
$$;

create or replace function public.pode_operar()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce((select papel in ('super_admin', 'owner', 'gestor', 'tecnico') and ativo from profiles where id = auth.uid()), false)
$$;

-- Conferência: as cinco helpers precisam terminar com row_security=off.
do $$
declare
  faltando text;
begin
  select string_agg(p.proname, ', ')
  into faltando
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('empresa_atual', 'eh_super_admin', 'pode_administrar_empresa', 'pode_gerir_cadastro', 'pode_operar')
    and not (coalesce(p.proconfig, '{}') @> array['row_security=off']);

  if faltando is not null then
    raise exception 'row_security=off ausente em: %', faltando;
  end if;
end $$;
