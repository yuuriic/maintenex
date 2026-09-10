-- Expõe as tabelas públicas da aplicação ao papel autenticado da API.
-- Grants SQL apenas permitem que PostgREST alcance as tabelas; RLS continua
-- sendo a camada de autorização por empresa/papel.
--
-- O Supabase local pode carregar default privileges amplos para objetos criados
-- por postgres. Por isso a migration primeiro remove privilégios desnecessários
-- das tabelas da aplicação e depois concede somente o mínimo usado pela API.

begin;

grant usage on schema public to authenticated;

revoke all privileges on table
  public.empresas,
  public.profiles,
  public.convites,
  public.cidades,
  public.setores,
  public.equipamentos,
  public.checklists,
  public.checklist_itens,
  public.materiais,
  public.estoque,
  public.movimentacoes,
  public.pendencias
from anon;

revoke truncate, references, trigger, maintain on table
  public.empresas,
  public.profiles,
  public.convites,
  public.cidades,
  public.setores,
  public.equipamentos,
  public.checklists,
  public.checklist_itens,
  public.materiais,
  public.estoque,
  public.movimentacoes,
  public.pendencias
from authenticated;

grant select, insert, update, delete on table
  public.empresas,
  public.profiles,
  public.convites,
  public.cidades,
  public.setores,
  public.equipamentos,
  public.checklists,
  public.checklist_itens,
  public.materiais,
  public.estoque,
  public.movimentacoes,
  public.pendencias
to authenticated;

revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all sequences in schema public from authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Futuras tabelas criadas pelo papel que executa as migrations (`postgres` no
-- Supabase CLI/db reset) não devem herdar privilégios amplos para a API.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from authenticated;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from authenticated;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated;

commit;
