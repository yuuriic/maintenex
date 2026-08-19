\set ON_ERROR_STOP off
-- No Supabase o papel authenticated já vem com GRANT por default privileges.
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- ============================================================
-- 1. Auto-cadastro: usuário informando empresa vira owner
-- ============================================================
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@alfa.com.br',
   '{"nome":"Ana","empresa_nome":"Alfa Manutenção"}'::jsonb);

insert into auth.users (id, email, raw_user_meta_data) values
  ('22222222-2222-2222-2222-222222222222', 'bruno@beta.com.br',
   '{"nome":"Bruno","empresa_nome":"Beta Serviços"}'::jsonb);

select '1. auto-cadastro' as teste,
       p.email, p.papel::text, e.nome as empresa, e.slug
from profiles p join empresas e on e.id = p.empresa_id order by p.email;

-- ============================================================
-- 2. Convite define a empresa e o papel do novo usuário
-- ============================================================
insert into convites (empresa_id, email, papel)
select id, 'carlos@alfa.com.br', 'tecnico' from empresas where slug = 'alfa-manutencao';

insert into auth.users (id, email, raw_user_meta_data) values
  ('33333333-3333-3333-3333-333333333333', 'carlos@alfa.com.br', '{"nome":"Carlos"}'::jsonb);

select '2. convite' as teste, p.email, p.papel::text, e.nome as empresa,
       (select aceito_em is not null from convites c where c.email = p.email) as convite_aceito
from profiles p join empresas e on e.id = p.empresa_id where p.email = 'carlos@alfa.com.br';

-- ============================================================
-- Dados de operação na empresa Alfa
-- ============================================================
insert into cidades (empresa_id, nome, uf) select id, 'Paranaguá', 'PR' from empresas where slug = 'alfa-manutencao';
insert into setores (empresa_id, cidade_id, nome) select c.empresa_id, c.id, 'Manutenção' from cidades c;
insert into equipamentos (empresa_id, cidade_id, setor_id, codigo, nome)
select c.empresa_id, c.id, s.id, 'EQP-0001', 'Multifuncional A3' from cidades c join setores s on s.cidade_id = c.id;
insert into materiais (empresa_id, codigo, nome, estoque_minimo)
select id, 'MAT-001', 'Toner Preto', 5 from empresas where slug = 'alfa-manutencao';

-- ============================================================
-- 3. Trigger de estoque: entrada 10, saída 4 -> saldo 6
-- ============================================================
insert into movimentacoes (empresa_id, material_id, cidade_id, tipo, quantidade)
select m.empresa_id, m.id, c.id, 'entrada', 10 from materiais m join cidades c on c.empresa_id = m.empresa_id;
insert into movimentacoes (empresa_id, material_id, cidade_id, tipo, quantidade)
select m.empresa_id, m.id, c.id, 'saida', 4 from materiais m join cidades c on c.empresa_id = m.empresa_id;

select '3. saldo do estoque' as teste, quantidade,
       case when quantidade = 6 then 'OK' else 'FALHOU' end as resultado from estoque;

-- ============================================================
-- 4. Isolamento: Bruno (Beta) não enxerga dados da Alfa
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select '4. isolamento leitura' as teste,
       (select count(*) from equipamentos) as equipamentos_visiveis,
       (select count(*) from empresas) as empresas_visiveis,
       case when (select count(*) from equipamentos) = 0 then 'OK' else 'VAZOU' end as resultado;

-- ============================================================
-- 5. Bruno tenta escrever na empresa Alfa
-- ============================================================
reset role;
select id as alfa_id from empresas where slug = 'alfa-manutencao' \gset
set role authenticated;
insert into equipamentos (empresa_id, cidade_id, codigo, nome)
values (:'alfa_id', (select id from cidades limit 1), 'INVASOR', 'invasor');

-- ============================================================
-- 6. Bruno tenta se promover a super_admin
-- ============================================================
update profiles set papel = 'super_admin' where id = '22222222-2222-2222-2222-222222222222';

-- ============================================================
-- 7. Bruno tenta convidar alguém como super_admin
-- ============================================================
insert into convites (empresa_id, email, papel)
select id, 'invasor@beta.com.br', 'super_admin' from empresas where slug = 'beta-servicos';

-- ============================================================
-- 8. Carlos (tecnico) não cria equipamento; owner cria
-- ============================================================
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into equipamentos (empresa_id, cidade_id, codigo, nome)
select empresa_id, id, 'EQP-TEC', 'criado por tecnico' from cidades limit 1;

-- ============================================================
-- 9. Carlos (tecnico) PODE registrar pendência (operação)
-- ============================================================
insert into pendencias (empresa_id, cidade_id, titulo)
select empresa_id, id, 'Pendência criada pelo técnico' from cidades limit 1;
select '9. tecnico opera' as teste, count(*) as pendencias, case when count(*) = 1 then 'OK' else 'FALHOU' end
from pendencias;

-- ============================================================
-- 10. Usuário desativado perde acesso
-- ============================================================
reset role;
update profiles set ativo = false where id = '33333333-3333-3333-3333-333333333333';
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select '10. usuario desativado' as teste, count(*) as equipamentos_visiveis,
       case when count(*) = 0 then 'OK' else 'FALHOU' end as resultado from equipamentos;
reset role;
