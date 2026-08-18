-- =========================================================================
-- Maintenex :: finalização
--
-- 1. remove as contas e empresas criadas pelo smoke test (e-mails com +qa-)
-- 2. promove o e-mail indicado a super_admin (administração da plataforma)
--
-- Troque o e-mail na primeira linha do bloco se quiser outro administrador.
-- Idempotente: pode rodar quantas vezes precisar.
-- =========================================================================

do $$
declare
  -- >>> e-mail do administrador da plataforma <<<
  email_admin constant text := 'giovani.ricetto@grupolelac.com.br';

  qtd_empresas integer;
  qtd_usuarios integer;
  promovidos integer;
begin
  -- --- 1. limpeza dos dados de teste -------------------------------------
  with alvos as (
    select distinct p.empresa_id
    from profiles p
    where p.email like '%+qa-%' and p.empresa_id is not null
  )
  delete from empresas e using alvos a where e.id = a.empresa_id;
  get diagnostics qtd_empresas = row_count;

  delete from auth.users where email like '%+qa-%';
  get diagnostics qtd_usuarios = row_count;

  raise notice 'limpeza: % empresa(s) e % usuario(s) de teste removidos', qtd_empresas, qtd_usuarios;

  -- --- 2. promoção a super_admin -----------------------------------------
  -- super_admin não pertence a nenhuma empresa: enxerga e administra todas
  update profiles
  set papel = 'super_admin', empresa_id = null
  where lower(email) = lower(email_admin);
  get diagnostics promovidos = row_count;

  if promovidos > 0 then
    raise notice 'super_admin definido para % — a aba Empresas aparece no menu', email_admin;
  else
    raise notice 'nenhuma conta encontrada para %', email_admin;
    raise notice 'crie a conta em /login?modo=cadastrar e rode este arquivo de novo';
  end if;
end $$;

select email, papel::text as papel, empresa_id from profiles order by papel, email;
