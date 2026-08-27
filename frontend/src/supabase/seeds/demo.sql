-- =========================================================
-- Maintenex :: dados de demonstração local (idempotente)
--
-- Popula o tenant do usuário local de performance. Rode depois de criar
-- a conta pelo app ou depois do harness local de RLS. Sem usuário ativo
-- não-super_admin, não faz nada.
--
-- Para escolher outro usuário local, execute antes:
--   select set_config('maintenex.seed_performance_email', 'usuario@example.test', false);
-- =========================================================

do $$
declare
  performance_email text := coalesce(
    nullif(current_setting('maintenex.seed_performance_email', true), ''),
    'rls-owner-a@example.test'
  );
  perf_user uuid;
  emp uuid;
  perf_papel papel_usuario;
  perf_ativo boolean;
begin
  select p.id, p.empresa_id, p.papel, p.ativo
    into perf_user, emp, perf_papel, perf_ativo
  from profiles p
  where lower(p.email) = lower(performance_email)
    and p.empresa_id is not null
    and p.papel <> 'super_admin'
  limit 1;

  if emp is null then
    select p.id, p.empresa_id, p.papel, p.ativo
      into perf_user, emp, perf_papel, perf_ativo
    from profiles p
    where p.empresa_id is not null
      and p.papel <> 'super_admin'
      and p.ativo
    order by p.criado_em, p.email
    limit 1;
  end if;

  if emp is null or perf_user is null or not coalesce(perf_ativo, false) then
    raise notice 'Nenhum usuário local ativo não-super_admin encontrado — seed ignorado.';
    return;
  end if;

  raise notice 'Populando tenant % para usuário % com papel %', emp, perf_user, perf_papel;

  -- Cidades ------------------------------------------------
  insert into cidades (empresa_id, nome, uf)
  select emp, v.nome, v.uf
  from (values
    ('Paranaguá', 'PR'),
    ('Curitiba', 'PR'),
    ('Joinville', 'SC')
  ) as v(nome, uf)
  on conflict (empresa_id, nome, uf) do nothing;

  -- Setores: 2 por cidade para cobrir filtros reais ------------
  insert into setores (empresa_id, cidade_id, nome, responsavel)
  select emp, c.id, s.nome, s.resp
  from cidades c
  cross join (values
    ('Manutenção', 'Diego Alves'),
    ('Operacional', 'Bruno Lima')
  ) as s(nome, resp)
  where c.empresa_id = emp
    and c.nome in ('Paranaguá', 'Curitiba', 'Joinville')
  on conflict (cidade_id, nome) do nothing;

  -- Materiais ----------------------------------------------
  insert into materiais (empresa_id, codigo, nome, categoria, unidade, estoque_minimo)
  select emp, v.codigo, v.nome, v.categoria, v.unidade, v.minimo
  from (values
    ('MAT-001', 'Toner Preto HP 26A', 'Suprimento', 'un', 10),
    ('MAT-002', 'Cilindro Fotocondutor', 'Peça', 'un', 5),
    ('MAT-003', 'Kit Manutenção 200k', 'Kit', 'kit', 2),
    ('MAT-004', 'Rolo de Tração', 'Peça', 'un', 8),
    ('MAT-005', 'Fusor 220V', 'Peça', 'un', 3),
    ('MAT-006', 'Álcool Isopropílico 1L', 'Consumível', 'l', 12),
    ('MAT-007', 'Pano Antiestático', 'Consumível', 'pct', 15),
    ('MAT-008', 'Correia de Transferência', 'Peça', 'un', 4)
  ) as v(codigo, nome, categoria, unidade, minimo)
  on conflict (empresa_id, codigo) do nothing;

  -- Equipamentos: 4 por cidade, sempre com cidade e setor --------
  insert into equipamentos (empresa_id, cidade_id, setor_id, codigo, nome, marca, modelo,
                            numero_serie, localizacao, status, contador, ultima_manutencao, proxima_manutencao)
  select
    emp,
    c.id,
    s.id,
    'LOAD-' || upper(c.uf) || '-' || lpad(dense_rank() over (order by c.nome)::text, 2, '0') || '-' || lpad(g::text, 3, '0'),
    (array['Multifuncional','Impressora Laser','Scanner de Produção','Plotter'])[1 + ((g - 1) % 4)] || ' ' ||
      (array['A3','A4','Color','Mono'])[1 + ((g - 1) % 4)],
    (array['HP','Brother','Kyocera','Epson'])[1 + ((g - 1) % 4)],
    (array['M428fdw','MFC-L8900','ECOSYS M3145','WF-C5790'])[1 + ((g - 1) % 4)],
    'LOADSN' || lpad((10000 + (dense_rank() over (order by c.nome) * 100) + g)::text, 8, '0'),
    c.nome || ' - Sala ' || (100 + g),
    (array['ativo','ativo','ativo','manutencao'])[1 + ((g - 1) % 4)]::status_equipamento,
    5000 + g * 1234,
    current_date - ((g * 11) || ' days')::interval,
    current_date + ((30 + g * 3) || ' days')::interval
  from cidades c
  join lateral (
    select id
    from setores s
    where s.cidade_id = c.id
      and s.empresa_id = emp
    order by case when s.nome = 'Manutenção' then 0 else 1 end, s.nome
    limit 1
  ) s on true
  cross join generate_series(1, 4) g
  where c.empresa_id = emp
    and c.nome in ('Paranaguá', 'Curitiba', 'Joinville')
  on conflict (empresa_id, codigo) do nothing;

  -- Checklists: 3 por equipamento representativo -----------------
  insert into checklists (empresa_id, equipamento_id, tipo, status, titulo, responsavel_id,
                          data_prevista, data_conclusao, tecnico_nome, observacoes)
  select
    emp,
    e.id,
    (array['preventiva','preventiva','corretiva'])[1 + ((g - 1) % 3)]::tipo_checklist,
    (array['concluido','pendente','em_andamento'])[1 + ((g - 1) % 3)]::status_checklist,
    'Checklist load local ' || g || ' - ' || e.codigo,
    perf_user,
    current_date - ((g * 7) % 45),
    case when g = 1 then now() - interval '7 days' end,
    'Técnico Demo Local',
    'Massa fictícia local para validação de concorrência inicial.'
  from equipamentos e
  cross join generate_series(1, 3) g
  where e.empresa_id = emp
    and e.codigo like 'LOAD-%'
    and not exists (
      select 1
      from checklists cl
      where cl.empresa_id = emp
        and cl.equipamento_id = e.id
        and cl.titulo = 'Checklist load local ' || g || ' - ' || e.codigo
    );

  -- Itens de checklist -------------------------------------
  insert into checklist_itens (empresa_id, checklist_id, secao, descricao, concluido, observacao, ordem)
  select emp, cl.id, i.secao, i.descricao, cl.status = 'concluido', i.observacao, i.ordem
  from checklists cl
  cross join lateral (
    select * from (values
      ('Inspeção física', 'Verificar integridade da estrutura ou carcaça', 'Sem anomalias críticas.', 1),
      ('Limpeza e conservação', 'Realizar limpeza externa do equipamento', 'Limpeza registrada no checklist.', 2),
      ('Energia e alimentação', 'Verificar fonte, carregador ou bateria', 'Alimentação dentro do esperado.', 3),
      ('Software e conectividade', 'Verificar sistema, firmware e conectividade', 'Conectividade validada localmente.', 4),
      ('Testes funcionais', 'Executar teste final de funcionamento', 'Teste funcional fictício concluído.', 5)
    ) as itens(secao, descricao, observacao, ordem)
  ) as i
  where cl.empresa_id = emp
    and cl.titulo like 'Checklist load local %'
    and not exists (
      select 1
      from checklist_itens ci
      where ci.checklist_id = cl.id
        and ci.ordem = i.ordem
    );

  -- Movimentações: massa moderada para PostgREST/RLS -------------
  insert into movimentacoes (empresa_id, material_id, cidade_id, equipamento_id, tipo, quantidade, motivo, usuario_id, criado_em)
  select
    emp,
    m.id,
    c.id,
    e.id,
    (array['entrada','saida','ajuste'])[1 + ((g - 1) % 3)]::tipo_movimentacao,
    2 + ((g + dense_rank() over (order by m.codigo, c.nome)) % 8),
    'Seed demo load local movimento ' || g || ' - ' || m.codigo || ' - ' || c.nome,
    perf_user,
    now() - ((g * 3 + dense_rank() over (order by m.codigo, c.nome)) || ' hours')::interval
  from materiais m
  join cidades c on c.empresa_id = emp and c.nome in ('Paranaguá', 'Curitiba', 'Joinville')
  join lateral (
    select id
    from equipamentos e
    where e.empresa_id = emp
      and e.cidade_id = c.id
      and e.codigo like 'LOAD-%'
    order by e.codigo
    limit 1
  ) e on true
  cross join generate_series(1, 3) g
  where m.empresa_id = emp
    and m.codigo like 'MAT-%'
    and not exists (
      select 1
      from movimentacoes mv
      where mv.empresa_id = emp
        and mv.material_id = m.id
        and mv.cidade_id = c.id
        and mv.motivo = 'Seed demo load local movimento ' || g || ' - ' || m.codigo || ' - ' || c.nome
    );

  -- Pendências: 2 por equipamento representativo -----------------
  insert into pendencias (empresa_id, cidade_id, equipamento_id, titulo, descricao,
                          prioridade, status, responsavel_id, aberta_em, fechada_em)
  select
    emp,
    e.cidade_id,
    e.id,
    'Pendência load local ' || g || ' - ' || e.codigo,
    'Registro fictício local associado ao equipamento ' || e.codigo || '.',
    (array['baixa','media','alta','critica'])[1 + ((g + dense_rank() over (order by e.codigo)) % 4)]::prioridade_pendencia,
    (array['aberta','em_andamento'])[g]::status_pendencia,
    perf_user,
    now() - ((g * 5 + dense_rank() over (order by e.codigo)) || ' hours')::interval,
    null::timestamptz
  from equipamentos e
  cross join generate_series(1, 2) g
  where e.empresa_id = emp
    and e.codigo like 'LOAD-%'
    and not exists (
      select 1
      from pendencias p
      where p.empresa_id = emp
        and p.equipamento_id = e.id
        and p.titulo = 'Pendência load local ' || g || ' - ' || e.codigo
    );
end $$;
