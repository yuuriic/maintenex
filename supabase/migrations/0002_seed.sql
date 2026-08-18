-- =========================================================
-- Maintenex :: dados de demonstração (idempotente)
--
-- Popula a PRIMEIRA empresa cadastrada. Rode depois de criar sua conta
-- pelo app (o auto-cadastro cria a empresa). Sem empresa, não faz nada.
-- =========================================================

do $$
declare
  emp uuid;
begin
  select id into emp from empresas order by criado_em limit 1;

  if emp is null then
    raise notice 'Nenhuma empresa cadastrada — seed ignorado. Crie a conta pelo app e rode de novo.';
    return;
  end if;

  raise notice 'Populando empresa %', emp;

  -- Cidades ------------------------------------------------
  insert into cidades (empresa_id, nome, uf)
  select emp, v.nome, v.uf
  from (values ('Paranaguá', 'PR'), ('Curitiba', 'PR'), ('Joinville', 'SC')) as v(nome, uf)
  on conflict (empresa_id, nome, uf) do nothing;

  -- Setores ------------------------------------------------
  insert into setores (empresa_id, cidade_id, nome, responsavel)
  select emp, c.id, s.nome, s.resp
  from cidades c
  cross join (values
    ('Administrativo', 'Ana Souza'),
    ('Operacional', 'Bruno Lima'),
    ('Almoxarifado Central', 'Carla Dias'),
    ('Manutenção', 'Diego Alves')
  ) as s(nome, resp)
  where c.empresa_id = emp
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

  -- Equipamentos -------------------------------------------
  insert into equipamentos (empresa_id, cidade_id, setor_id, codigo, nome, marca, modelo,
                            numero_serie, localizacao, status, contador, ultima_manutencao, proxima_manutencao)
  select
    emp,
    c.id,
    (select s.id from setores s where s.cidade_id = c.id order by s.nome limit 1),
    'EQP-' || upper(left(c.uf, 2)) || '-' || lpad(g::text, 3, '0'),
    (array['Multifuncional','Impressora Laser','Scanner de Produção','Plotter'])[1 + (g % 4)] || ' ' ||
      (array['A3','A4','Color','Mono'])[1 + (g % 4)],
    (array['HP','Brother','Kyocera','Epson'])[1 + (g % 4)],
    (array['M428fdw','MFC-L8900','ECOSYS M3145','WF-C5790'])[1 + (g % 4)],
    'SN' || lpad((10000 + g * 37)::text, 8, '0'),
    'Sala ' || (100 + g),
    (array['ativo','ativo','ativo','manutencao','inativo'])[1 + (g % 5)]::status_equipamento,
    5000 + g * 1234,
    current_date - ((g % 90) || ' days')::interval,
    current_date + ((30 - (g % 30)) || ' days')::interval
  from cidades c, generate_series(1, 8) g
  where c.empresa_id = emp
  on conflict (empresa_id, codigo) do nothing;

  -- Checklists ---------------------------------------------
  insert into checklists (empresa_id, equipamento_id, tipo, status, titulo, data_prevista, data_conclusao)
  select
    emp, e.id,
    (array['preventiva','preventiva','preventiva','corretiva'])[1 + (g % 4)]::tipo_checklist,
    (array['concluido','concluido','pendente','em_andamento'])[1 + (g % 4)]::status_checklist,
    (array['Limpeza geral','Troca de suprimento','Revisão mecânica','Correção de atolamento'])[1 + (g % 4)],
    current_date - ((g * 7) % 120),
    case when g % 4 < 2 then now() - (((g * 7) % 120) || ' days')::interval end
  from equipamentos e, generate_series(1, 3) g
  where e.empresa_id = emp
    and not exists (select 1 from checklists cl where cl.equipamento_id = e.id);

  -- Itens de checklist -------------------------------------
  insert into checklist_itens (empresa_id, checklist_id, descricao, concluido, ordem)
  select emp, cl.id, i.descricao, cl.status = 'concluido', i.ordem
  from checklists cl
  cross join (values
    ('Verificar contador de páginas', 1),
    ('Limpar vidro e ADF', 2),
    ('Conferir nível de suprimentos', 3),
    ('Testar impressão de página de teste', 4),
    ('Registrar ocorrências', 5)
  ) as i(descricao, ordem)
  where cl.empresa_id = emp
    and not exists (select 1 from checklist_itens ci where ci.checklist_id = cl.id);

  -- Movimentações (o trigger atualiza o estoque) -----------
  insert into movimentacoes (empresa_id, material_id, cidade_id, tipo, quantidade, motivo, criado_em)
  select
    emp, m.id, c.id,
    (array['entrada','saida','saida','entrada'])[1 + (g % 4)]::tipo_movimentacao,
    1 + (g % 9),
    (array['Compra','Consumo em preventiva','Consumo em corretiva','Reposição'])[1 + (g % 4)],
    now() - ((g * 5) || ' days')::interval
  from materiais m, cidades c, generate_series(1, 4) g
  where m.empresa_id = emp and c.empresa_id = emp
    and not exists (select 1 from movimentacoes mv where mv.material_id = m.id and mv.cidade_id = c.id);

  -- Pendências ---------------------------------------------
  insert into pendencias (empresa_id, cidade_id, equipamento_id, titulo, descricao,
                          prioridade, status, aberta_em, fechada_em)
  select
    emp, e.cidade_id, e.id,
    (array['Ruído anormal no fusor','Falha de rede intermitente','Atolamento recorrente','Qualidade de impressão baixa'])[1 + (g % 4)],
    'Registrado durante inspeção de rotina no equipamento ' || e.codigo || '.',
    (array['baixa','media','alta','critica'])[1 + (g % 4)]::prioridade_pendencia,
    (array['aberta','aberta','em_andamento','resolvida'])[1 + (g % 4)]::status_pendencia,
    now() - ((g * 9) || ' days')::interval,
    case when g % 4 = 3 then now() - ((g * 3) || ' days')::interval end
  from equipamentos e, generate_series(1, 2) g
  where e.empresa_id = emp
    and not exists (select 1 from pendencias p where p.equipamento_id = e.id);
end $$;
