import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { Download, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Painel, Skeleton, StatCard, Vazio } from '../components/ui'
import { baixarCsv, data, nf, titulo } from '../lib/format'
import type { Checklist, Equipamento, Movimentacao, Pendencia } from '../lib/types'

const CORES = ['#4f8cff', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4']
const PERIODOS = [
  { chave: '30', rotulo: 'Últimos 30 dias' },
  { chave: '90', rotulo: 'Últimos 90 dias' },
  { chave: '180', rotulo: 'Últimos 6 meses' },
  { chave: '365', rotulo: 'Últimos 12 meses' },
]

export default function Relatorios() {
  const { cidadeId, cidadeAtual } = useApp()
  const toast = useToast()
  const [periodo, setPeriodo] = useState('90')

  const { dados, carregando } = useConsulta(async () => {
    const desde = new Date(Date.now() - Number(periodo) * 86_400_000).toISOString()
    const escopo = <T,>(q: T) => (cidadeId ? (q as any).eq('cidade_id', cidadeId) : q)

    const [eq, ck, pe, mv] = await Promise.all([
      escopo(supabase.from('equipamentos').select('*, setores(id, nome)')),
      supabase.from('checklists').select('*, equipamentos(id, codigo, nome, cidade_id)').gte('data_prevista', desde.slice(0, 10)),
      escopo(supabase.from('pendencias').select('*, equipamentos(id, codigo, nome)')).gte('aberta_em', desde),
      escopo(supabase.from('movimentacoes').select('*, materiais(id, codigo, nome, unidade)')).gte('criado_em', desde),
    ])

    const equipamentos = (eq.data ?? []) as Equipamento[]
    const ids = new Set(equipamentos.map((e) => e.id))
    return {
      equipamentos,
      checklists: ((ck.data ?? []) as Checklist[]).filter((c) => ids.has(c.equipamento_id)),
      pendencias: (pe.data ?? []) as Pendencia[],
      movimentacoes: (mv.data ?? []) as Movimentacao[],
    }
  }, [cidadeId, periodo])

  const rel = useMemo(() => {
    const d = dados ?? { equipamentos: [], checklists: [], pendencias: [], movimentacoes: [] }

    const porStatusEquip = Object.entries(
      d.equipamentos.reduce<Record<string, number>>((acc, e) => {
        acc[titulo(e.status)] = (acc[titulo(e.status)] ?? 0) + 1
        return acc
      }, {}),
    ).map(([nome, valor]) => ({ nome, valor }))

    const porSetor = Object.entries(
      d.checklists.reduce<Record<string, number>>((acc, c) => {
        const eq = d.equipamentos.find((e) => e.id === c.equipamento_id)
        const nome = eq?.setores?.nome ?? 'Sem setor'
        acc[nome] = (acc[nome] ?? 0) + 1
        return acc
      }, {}),
    ).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)

    const consumoPorMes = Object.values(
      d.movimentacoes.filter((m) => m.tipo === 'saida').reduce<Record<string, { mes: string; qtd: number; ordem: number }>>((acc, m) => {
        const dt = new Date(m.criado_em)
        const chave = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
        const rotulo = dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        acc[chave] = { mes: rotulo, qtd: (acc[chave]?.qtd ?? 0) + m.quantidade, ordem: dt.getTime() }
        return acc
      }, {}),
    ).sort((a, b) => a.ordem - b.ordem)

    const rankingEquip = d.equipamentos.map((e) => ({
      codigo: e.codigo,
      nome: e.nome,
      setor: e.setores?.nome ?? '—',
      corretivas: d.checklists.filter((c) => c.equipamento_id === e.id && c.tipo === 'corretiva').length,
      preventivas: d.checklists.filter((c) => c.equipamento_id === e.id && c.tipo === 'preventiva').length,
      pendencias: d.pendencias.filter((p) => p.equipamento_id === e.id).length,
      contador: e.contador,
      ultima: e.ultima_manutencao,
    })).sort((a, b) => (b.corretivas + b.pendencias) - (a.corretivas + a.pendencias)).slice(0, 10)

    const resolvidas = d.pendencias.filter((p) => p.status === 'resolvida' && p.fechada_em)
    const sla = resolvidas.length
      ? resolvidas.reduce((s, p) =>
          s + (new Date(p.fechada_em!).getTime() - new Date(p.aberta_em).getTime()) / 86_400_000, 0) / resolvidas.length
      : 0

    const concluidos = d.checklists.filter((c) => c.status === 'concluido').length
    return {
      bruto: d,
      porStatusEquip, porSetor, consumoPorMes, rankingEquip,
      totalChecklists: d.checklists.length,
      conclusao: d.checklists.length ? Math.round((concluidos / d.checklists.length) * 100) : 0,
      sla: sla.toFixed(1),
      consumo: d.movimentacoes.filter((m) => m.tipo === 'saida').reduce((s, m) => s + m.quantidade, 0),
    }
  }, [dados])

  function exportarChecklists() {
    baixarCsv('relatorio-checklists.csv', rel.bruto.checklists.map((c) => ({
      equipamento: c.equipamentos?.codigo ?? '', titulo: c.titulo, tipo: c.tipo, status: c.status,
      data_prevista: c.data_prevista, data_conclusao: c.data_conclusao ?? '',
    })))
    toast.info('CSV de checklists gerado.')
  }

  function exportarRanking() {
    baixarCsv('relatorio-equipamentos.csv', rel.rankingEquip)
    toast.info('CSV de equipamentos gerado.')
  }

  const eixo = { stroke: 'var(--txt-fraco)', fontSize: 12 }
  const tooltipEstilo = {
    background: 'var(--sup-2)', border: '1px solid var(--borda)',
    borderRadius: 10, color: 'var(--txt)', fontSize: 13,
  }

  return (
    <section>
      <div className="title-row">
        <div>
          <h1>Relatórios</h1>
          <p>{cidadeAtual ? `${cidadeAtual.nome} - ${cidadeAtual.uf}` : 'Todas as cidades'} · {PERIODOS.find((p) => p.chave === periodo)?.rotulo.toLowerCase()}</p>
        </div>
        <div className="acoes-topo">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => <option key={p.chave} value={p.chave}>{p.rotulo}</option>)}
          </select>
          <button className="btn" onClick={exportarChecklists}><Download size={16} />Checklists</button>
          <button className="btn" onClick={exportarRanking}><FileSpreadsheet size={16} />Equipamentos</button>
        </div>
      </div>

      {carregando ? <Skeleton linhas={8} /> : (
        <>
          <div className="cards">
            <StatCard tom="azul" rotulo="Checklists no período" valor={nf.format(rel.totalChecklists)} detalhe={`${rel.conclusao}% concluídos`} />
            <StatCard tom="verde" rotulo="Taxa de conclusão" valor={`${rel.conclusao}%`} detalhe="checklists finalizados" />
            <StatCard tom="ambar" rotulo="SLA médio" valor={`${rel.sla} d`} detalhe="pendências resolvidas" />
            <StatCard tom="roxo" rotulo="Consumo de materiais" valor={nf.format(rel.consumo)} detalhe="unidades baixadas" />
          </div>

          <div className="dashboard-grid">
            <Painel titulo="Consumo de materiais por mês" className="span-2">
              {!rel.consumoPorMes.length ? <Vazio texto="Sem saídas no período" compacto /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={rel.consumoPorMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" vertical={false} />
                    <XAxis dataKey="mes" {...eixo} tickLine={false} axisLine={false} />
                    <YAxis {...eixo} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipEstilo} />
                    <Line type="monotone" dataKey="qtd" name="Unidades" stroke={CORES[0]} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Painel>

            <Painel titulo="Equipamentos por status">
              {!rel.porStatusEquip.length ? <Vazio compacto /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={rel.porStatusEquip} dataKey="valor" nameKey="nome" outerRadius={80}>
                      {rel.porStatusEquip.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipEstilo} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Painel>

            <Painel titulo="Checklists por setor">
              {!rel.porSetor.length ? <Vazio compacto /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={rel.porSetor} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" horizontal={false} />
                    <XAxis type="number" {...eixo} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="nome" {...eixo} width={110} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipEstilo} cursor={{ fill: 'var(--sup-3)' }} />
                    <Bar dataKey="valor" name="Checklists" fill={CORES[3]} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Painel>

            <Painel titulo="Equipamentos que mais exigem atenção" className="span-3">
              {!rel.rankingEquip.length ? <Vazio compacto /> : (
                <div className="tabela-wrap">
                  <table className="tabela">
                    <thead>
                      <tr><th>#</th><th>Código</th><th>Equipamento</th><th>Setor</th>
                        <th>Corretivas</th><th>Preventivas</th><th>Pendências</th><th>Contador</th><th>Última manut.</th></tr>
                    </thead>
                    <tbody>
                      {rel.rankingEquip.map((e, i) => (
                        <tr key={e.codigo}>
                          <td><span className="posicao">{i + 1}</span></td>
                          <td><code>{e.codigo}</code></td>
                          <td><b>{e.nome}</b></td>
                          <td>{e.setor}</td>
                          <td>{e.corretivas}</td>
                          <td>{e.preventivas}</td>
                          <td>{e.pendencias}</td>
                          <td>{nf.format(e.contador)}</td>
                          <td>{data(e.ultima)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Painel>
          </div>
        </>
      )}
    </section>
  )
}
