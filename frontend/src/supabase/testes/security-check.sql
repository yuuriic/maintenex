-- Verificação local de segurança para migrations do Maintenex.
-- Uso esperado após `supabase db reset` local:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f frontend/src/supabase/testes/security-check.sql
--
-- Não cria dados e não altera schema. Falha se alguma tabela pública da
-- aplicação estiver sem RLS, sem policy, com grants excessivos para
-- authenticated, com acesso indevido para anon ou com default privileges
-- inseguros para futuras tabelas criadas por postgres.

set search_path = public, extensions;

do $$
declare
  violations text;
begin
  with public_tables as (
    select c.oid, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  ),
  postgres_default_table_acl as (
    select e.grantee, e.privilege_type
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) e
    where d.defaclrole = 'postgres'::regrole
      and n.nspname = 'public'
      and d.defaclobjtype = 'r'
  ),
  checks as (
    select format('RLS disabled: public.%s', t.table_name) as violation
    from public_tables t
    join pg_class c on c.oid = t.oid
    where not c.relrowsecurity

    union all

    select format('missing RLS policy: public.%s', t.table_name) as violation
    from public_tables t
    where not exists (
      select 1
      from pg_policy p
      where p.polrelid = t.oid
    )

    union all

    select format('authenticated missing %s: public.%s', required.privilege_type, t.table_name) as violation
    from public_tables t
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as required(privilege_type)
    where not exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.table_name = t.table_name
        and g.grantee = 'authenticated'
        and g.privilege_type = required.privilege_type
    )

    union all

    select format('authenticated excessive %s: public.%s', g.privilege_type, g.table_name) as violation
    from information_schema.role_table_grants g
    join public_tables t on t.table_name = g.table_name
    where g.table_schema = 'public'
      and g.grantee = 'authenticated'
      and g.privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')

    union all

    select format('anon table grant %s: public.%s', g.privilege_type, g.table_name) as violation
    from information_schema.role_table_grants g
    join public_tables t on t.table_name = g.table_name
    where g.table_schema = 'public'
      and g.grantee = 'anon'

    union all

    select format('anon sequence grant %s: public.%s', g.privilege_type, g.object_name) as violation
    from information_schema.role_usage_grants g
    where g.object_schema = 'public'
      and g.grantee = 'anon'
      and g.object_type = 'SEQUENCE'

    union all

    select 'postgres default privileges grant excessive table privileges to authenticated' as violation
    from postgres_default_table_acl a
    where a.grantee = 'authenticated'::regrole
      and a.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')

    union all

    select 'postgres default privileges grant table access to anon' as violation
    from postgres_default_table_acl a
    where a.grantee = 'anon'::regrole
  )
  select string_agg(violation, E'\n' order by violation)
  into violations
  from checks;

  if violations is not null then
    raise exception 'Maintenex security-check failed:%', E'\n' || violations;
  end if;
end $$;

select 'Maintenex security-check passed' as result;
