import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, Boxes, Printer, TriangleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useConsulta } from '../hooks/useConsulta'
import { Badge, Painel, Skeleton, StatCard, Vazio } from '../components/ui'
import { data, nf, titulo } from '../lib/format'
import type { Checklist, Equipamento, Movimentacao, Pendencia } from '../lib/types'

const CORES = ['#8b8b96', '#3fb950', '#d29922', '#a371f7', '#f85149', '#39c5cf']

interface Painelzinho {
  equipamentos: Equipamento[]
  checklists: Checklist[]
  pendencias: Pendencia[]
  movimentacoes: Movimentacao[]
}

export default function Dashboard() {
  const { cidadeId, cidadeAtual, setorId } = useApp()

  const { dados, carregando } = useConsulta<Painelzinho>(async () => {
    const filtroCidade = <T,>(q: T) => (cidadeId ? (q as any).eq('cidade_id', cidadeId) : q)

    const [eq, ck, pe, mv] = await Promise.all([
      filtroCidade(supabase.from('equipamentos').select('*, setores(id, nome)')),
      supabase.from('checklists').select('*, equipamentos(id, codigo, nome, cidade_id)').order('data_prevista', { ascending: false }),
      filtroCidade(supabase.from('pendencias').select('*, equipamentos(id, codigo, nome)')),
      filtroCidade(supabase.from('movimentacoes').select('*, materiais(id, codigo, nome, unidade)').order('criado_em', { ascending: false })),
    ])

    const equipamentos = ((eq.data ?? []) as Equipamento[]).filter((e) => !setorId || e.setor_id === setorId)
    const idsEquip = new Set(equipamentos.map((e) => e.id))

    return {
      equipamentos,
      checklists: ((ck.data ?? []) as Checklist[]).filter((c) => idsEquip.has(c.equipamento_id)),
      pendencias: ((pe.data ?? []) as Pendencia[]),
      movimentacoes: ((mv.data ?? []) as Movimentacao[]),
    }
  }, [cidadeId, setorId])

  const m = useMemo(() => {
    const d = dados ?? { equipamentos: [], checklists: [], pendencias: [], movimentacoes: [] }
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
    const inicioMesAnterior = new Date(inicioMes); inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1)

    const concluidos = d.checklists.filter((c) => c.status === 'concluido' && c.data_conclusao)
    const noMes = concluidos.filter((c) => new Date(c.data_conclusao!) >= inicioMes)
    const mesAnterior = concluidos.filter((c) => {
      const dt = new Date(c.data_conclusao!)
      return dt >= inicioMesAnterior && dt < inicioMes
    })

    const preventivas = noMes.filter((c) => c.tipo === 'preventiva').length
    const corretivas = noMes.filter((c) => c.tipo === 'corretiva').length

    const abertas = d.pendencias.filter((p) => p.status === 'aberta' || p.status === 'em_andamento')
    const resolvidas = d.pendencias.filter((p) => p.status === 'resolvida' && p.fechada_em)
    const sla = resolvidas.length
      ? resolvidas.reduce((s, p) =>
          s + (new Date(p.fechada_em!).getTime() - new Date(p.aberta_em).getTime()) / 86_400_000, 0) / resolvidas.length
      : 0

    const saidasMes = d.movimentacoes.filter((mo) => mo.tipo === 'saida' && new Date(mo.criado_em) >= inicioMes)

    // série dos últimos 6 meses
    const meses = Array.from({ length: 6 }, (_, i) => {
      const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - (5 - i))
      return { chave: `${dt.getFullYear()}-${dt.getMonth()}`, rotulo: dt.toLocaleDateString('pt-BR', { month: 'short' }) }
    })
    const serie = meses.map(({ chave, rotulo }) => {
      const doMes = concluidos.filter((c) => {
        const dt = new Date(c.data_conclusao!)
        return `${dt.getFullYear()}-${dt.getMonth()}` === chave
      })
      return {
        mes: rotulo,
        preventivas: doMes.filter((c) => c.tipo === 'preventiva').length,
        corretivas: doMes.filter((c) => c.tipo === 'corretiva').length,
        total: doMes.length,
      }
    })

    const porSetor = Object.entries(
      d.equipamentos.reduce<Record<string, number>>((acc, e) => {
        const nome = e.setores?.nome ?? 'Sem setor'
        acc[nome] = (acc[nome] ?? 0) + 1
        return acc
      }, {}),
    ).map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .map((item, index) => ({ ...item, fill: CORES[index % CORES.length] }))

    const topMateriais = Object.values(
      d.movimentacoes.filter((mo) => mo.tipo === 'saida').reduce<Record<string, { nome: string; qtd: number }>>((acc, mo) => {
        const nome = mo.materiais?.nome ?? 'Material'
        acc[nome] = { nome, qtd: (acc[nome]?.qtd ?? 0) + mo.quantidade }
        return acc
      }, {}),
    ).sort((a, b) => b.qtd - a.qtd).slice(0, 5)

    return {
      preventivas, corretivas,
      totalMes: noMes.length, totalMesAnterior: mesAnterior.length,
      razao: corretivas ? (preventivas / corretivas).toFixed(2) : preventivas ? '∞' : '0',
      abertas: abertas.length, sla: sla.toFixed(1),
      baixas: saidasMes.reduce((s, mo) => s + mo.quantidade, 0),
      equipamentosAtivos: d.equipamentos.filter((e) => e.status === 'ativo').length,
      totalEquipamentos: d.equipamentos.length,
      serie, porSetor, topMateriais,
      proximas: d.equipamentos
        .filter((e) => e.proxima_manutencao)
        .sort((a, b) => a.proxima_manutencao!.localeCompare(b.proxima_manutencao!))
        .slice(0, 6),
      criticas: abertas.filter((p) => p.prioridade === 'critica' || p.prioridade === 'alta').slice(0, 5),
    }
  }, [dados])

  if (carregando) return <section><div className="title-row"><h1>Dashboard</h1></div><Skeleton linhas={8} /></section>

  const eixo = { stroke: 'var(--txt-fraco)', fontSize: 12 }
  const tooltipEstilo = {
    background: 'var(--sup-2)', border: '1px solid var(--borda)',
    borderRadius: 10, color: 'var(--txt)', fontSize: 13,
  }

  return (
    <section>
      <div className="title-row">
        <div>
          <h1>Dashboard</h1>
          <p>{cidadeAtual ? `${cidadeAtual.nome} - ${cidadeAtual.uf}` : 'Todas as cidades'} • período atual</p>
        </div>
        <Badge tom="verde">{m.equipamentosAtivos}/{m.totalEquipamentos} equipamentos ativos</Badge>
      </div>

      <div className="cards">
        <StatCard tom="azul" rotulo="Preventivas realizadas" valor={nf.format(m.preventivas)}
          detalhe={`${m.totalMesAnterior} no mês anterior`} icone={<Activity size={18} />} />
        <StatCard tom="roxo" rotulo="Razão P/C" valor={m.razao}
          detalhe={`${m.corretivas} corretiva(s)`} icone={<Printer size={18} />} />
        <StatCard tom="ambar" rotulo="Pendências abertas" valor={nf.format(m.abertas)}
          detalhe={`SLA médio: ${m.sla} dias`} icone={<TriangleAlert size={18} />} />
        <StatCard tom="verde" rotulo="Baixas no período" valor={nf.format(m.baixas)}
          detalhe="consumo registrado" icone={<Boxes size={18} />} />
      </div>

      <div className="dashboard-grid">
        <Painel titulo="Preventivas × Corretivas" className="span-2">
          {!m.serie.some((s) => s.total) ? <Vazio texto="Sem checklists concluídos no período" compacto /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={m.serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" vertical={false} />
                <XAxis dataKey="mes" {...eixo} tickLine={false} axisLine={false} />
                <YAxis {...eixo} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipEstilo} cursor={{ fill: 'var(--sup-3)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="preventivas" name="Preventivas" fill={CORES[1]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="corretivas" name="Corretivas" fill={CORES[4]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Painel>

        <Painel titulo="Evolução de checklists">
          {!m.serie.some((s) => s.total) ? <Vazio texto="Sem dados no período" compacto /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={m.serie}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CORES[1]} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CORES[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" vertical={false} />
                <XAxis dataKey="mes" {...eixo} tickLine={false} axisLine={false} />
                <YAxis {...eixo} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipEstilo} />
                <Area type="monotone" dataKey="total" name="Concluídos" stroke={CORES[1]} fill="url(#grad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Painel>

        <Painel titulo="Distribuição por setor">
          {!m.porSetor.length ? <Vazio texto="Sem dados para exibir" compacto /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={m.porSetor} dataKey="valor" nameKey="nome" innerRadius={52} outerRadius={82} paddingAngle={3} />
                <Tooltip contentStyle={tooltipEstilo} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Painel>

        <Painel titulo="Top 5 materiais">
          {!m.topMateriais.length ? <Vazio texto="Nenhum material utilizado" compacto /> : (
            <ul className="ranking">
              {m.topMateriais.map((mat, i) => {
                const maximo = m.topMateriais[0].qtd || 1
                return (
                  <li key={mat.nome}>
                    <span className="posicao">{i + 1}</span>
                    <div className="ranking-barra">
                      <b>{mat.nome}</b>
                      <div className="barra"><div style={{ width: `${(mat.qtd / maximo) * 100}%`, background: CORES[i % CORES.length] }} /></div>
                    </div>
                    <strong>{nf.format(mat.qtd)}</strong>
                  </li>
                )
              })}
            </ul>
          )}
        </Painel>

        <Painel titulo="Próximas manutenções" acao={<Link className="link" to="/app/equipamentos">ver todos</Link>}>
          {!m.proximas.length ? <Vazio texto="Nada agendado" compacto /> : (
            <ul className="lista-simples">
              {m.proximas.map((e) => (
                <li key={e.id}>
                  <div><b>{e.codigo}</b><small>{e.nome}</small></div>
                  <Badge tom={new Date(e.proxima_manutencao!) < new Date() ? 'vermelho' : 'azul'}>
                    {data(e.proxima_manutencao)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel titulo="Pendências prioritárias" acao={<Link className="link" to="/app/pendencias">abrir quadro</Link>}>
          {!m.criticas.length ? <Vazio texto="Nenhuma pendência crítica" compacto /> : (
            <ul className="lista-simples">
              {m.criticas.map((p) => (
                <li key={p.id}>
                  <div><b>{p.titulo}</b><small>{p.equipamentos?.codigo ?? 'Sem equipamento'}</small></div>
                  <Badge tom={p.prioridade === 'critica' ? 'vermelho' : 'ambar'}>{titulo(p.prioridade)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </section>
  )
}
