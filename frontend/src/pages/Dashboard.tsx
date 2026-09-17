import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Scatter,
  ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, Boxes, CalendarDays, CheckCircle2, Clock3, Package, Printer, TriangleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useConsulta } from '../hooks/useConsulta'
import { Badge, ErroDados, Painel, Skeleton, Vazio } from '../components/ui'
import {
  DASHBOARD_LAYOUT_PADRAO, DASHBOARD_METRICS, catalogoDoDashboard, normalizarDashboardLayout,
  type DashboardDimension, type DashboardLayout, type DashboardMetric, type DashboardWidget,
} from '../lib/dashboard-config'
import type { Checklist, Equipamento, Movimentacao, Pendencia } from '../lib/types'

const CORES = ['#3b82f6', '#3fb950', '#d29922', '#a371f7', '#f85149', '#39c5cf', '#8b8b96']
const tooltipEstilo = {
  background: 'var(--sup-2)', border: '1px solid var(--borda)',
  borderRadius: 10, color: 'var(--txt)', fontSize: 13,
}

interface Painelzinho {
  equipamentos: Equipamento[]
  checklists: Checklist[]
  pendencias: Pendencia[]
  movimentacoes: Movimentacao[]
}

interface Categoria { nome: string; valor: number; fill?: string }
interface Serie { label: string; valor: number; auxiliar?: number }
interface Evento { data: string; titulo: string; detalhe: string; tom: string }

interface DadosDashboard extends Painelzinho {
  metricas: Record<DashboardMetric, number>
  categorias: Record<DashboardDimension, Categoria[]>
  series: Record<DashboardMetric, Serie[]>
  serieDiaria: Serie[]
  proximas: Equipamento[]
  criticas: Pendencia[]
  eventos: Evento[]
}

function rotulo(valor: string | null | undefined) {
  const mapa: Record<string, string> = {
    ativo: 'Ativo', manutencao: 'Em manutenção', inativo: 'Inativo',
    pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado',
    aberta: 'Aberta', resolvida: 'Resolvida', baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica',
    preventiva: 'Preventiva', corretiva: 'Corretiva', entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste',
  }
  return mapa[valor ?? ''] ?? valor ?? 'Sem classificação'
}

function contar(valores: string[]) {
  const contagem = valores.reduce<Record<string, number>>((acc, valor) => {
    acc[valor] = (acc[valor] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(contagem)
    .map(([nome, valor], index) => ({ nome, valor, fill: CORES[index % CORES.length] }))
    .sort((a, b) => b.valor - a.valor)
}

function nf(valor: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(valor) }
function dataCurta(valor: string | null | undefined) {
  return valor ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(valor)) : '—'
}
function nomeMetrica(metric: DashboardMetric) {
  return DASHBOARD_METRICS.find((item) => item.value === metric)?.label ?? metric
}

function MiniSerie({ itens }: { itens: Serie[] }) {
  return <div className="dashboard-mini-chart"><ResponsiveContainer width="100%" height={58}><AreaChart data={itens}><Area type="monotone" dataKey="valor" stroke="var(--primaria)" fill="var(--primaria-suave)" strokeWidth={2} dot={false} /></AreaChart></ResponsiveContainer></div>
}

function MetricVisual({ metric, valor, serie, tipo }: { metric: DashboardMetric; valor: number; serie: Serie[]; tipo: string }) {
  const percentual = metric === 'taxa_conclusao'
  return <div className="dashboard-metric-visual"><div className="dashboard-metric-value">{percentual ? `${nf(valor)}%` : nf(valor)}</div><small>{nomeMetrica(metric)}</small>{(tipo === 'stat' || tipo === 'sparkline' || tipo === 'delta') && <MiniSerie itens={serie} />}{tipo === 'delta' && <span className="dashboard-delta">Comparação no período atual</span>}</div>
}

function LineVisual({ itens, area = false, combo = false }: { itens: Serie[]; area?: boolean; combo?: boolean }) {
  if (!itens.some((item) => item.valor)) return <Vazio texto="Sem dados para o período" compacto />
  return <ResponsiveContainer width="100%" height={180}>{combo ? <BarChart data={itens}><CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" vertical={false} /><XAxis dataKey="label" stroke="var(--txt-fraco)" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="var(--txt-fraco)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltipEstilo} /><Bar dataKey="valor" name="Volume" fill="var(--primaria)" radius={[5, 5, 0, 0]} /><Line type="monotone" dataKey="auxiliar" name="Referência" stroke="var(--verde)" strokeWidth={2} dot={false} /></BarChart> : area ? <AreaChart data={itens}><CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" vertical={false} /><XAxis dataKey="label" stroke="var(--txt-fraco)" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="var(--txt-fraco)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltipEstilo} /><Area type="monotone" dataKey="valor" name="Valor" stroke="var(--primaria)" fill="var(--primaria-suave)" strokeWidth={2} /></AreaChart> : <LineChart data={itens}><CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" vertical={false} /><XAxis dataKey="label" stroke="var(--txt-fraco)" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="var(--txt-fraco)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltipEstilo} /><Line type="monotone" dataKey="valor" name="Valor" stroke="var(--primaria)" strokeWidth={2} dot={{ r: 3 }} /></LineChart>}</ResponsiveContainer>
}

function CategoriaVisual({ itens, tipo }: { itens: Categoria[]; tipo: string }) {
  if (!itens.length) return <Vazio texto="Sem categorias para exibir" compacto />
  if (tipo === 'ranking' || tipo === 'top_bottom' || tipo === 'sla_ranking') {
    const lista = tipo === 'top_bottom' ? [...itens.slice(0, 2), ...itens.slice(-2).reverse()] : itens.slice(0, 6)
    return <ul className="ranking">{lista.map((item, index) => <li key={`${item.nome}-${index}`}><span className="posicao">{index + 1}</span><div className="ranking-barra"><b>{item.nome}</b><div className="barra"><div style={{ width: `${(item.valor / (itens[0].valor || 1)) * 100}%`, background: item.fill }} /></div></div><strong>{nf(item.valor)}</strong></li>)}</ul>
  }
  if (tipo === 'word_cloud') {
    const max = itens[0]?.valor || 1
    return <div className="dashboard-word-cloud">{itens.slice(0, 12).map((item) => <span key={item.nome} style={{ fontSize: `${.78 + (item.valor / max) * .8}rem`, color: item.fill }}>{item.nome}</span>)}</div>
  }
  return <ResponsiveContainer width="100%" height={180}><BarChart data={itens.slice(0, 10)} layout={tipo === 'bar_gauge' ? 'vertical' : 'horizontal'}><CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" vertical={false} />{tipo === 'bar_gauge' ? <><XAxis type="number" stroke="var(--txt-fraco)" fontSize={11} allowDecimals={false} /><YAxis type="category" dataKey="nome" stroke="var(--txt-fraco)" fontSize={11} width={92} /></> : <><XAxis dataKey="nome" stroke="var(--txt-fraco)" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="var(--txt-fraco)" fontSize={11} allowDecimals={false} /></>}<Tooltip contentStyle={tooltipEstilo} /><Bar dataKey="valor" name="Quantidade" fill="var(--primaria)" radius={[5, 5, 0, 0]}>{itens.slice(0, 10).map((item, index) => <Cell key={item.nome} fill={item.fill ?? CORES[index % CORES.length]} />)}</Bar></BarChart></ResponsiveContainer>
}

function PizzaVisual({ itens, donut = false }: { itens: Categoria[]; donut?: boolean }) {
  if (!itens.length) return <Vazio texto="Sem categorias para exibir" compacto />
  return <ResponsiveContainer width="100%" height={180}><PieChart><Pie data={itens.slice(0, 8)} dataKey="valor" nameKey="nome" innerRadius={donut ? 48 : 0} outerRadius={64} paddingAngle={3}>{itens.slice(0, 8).map((item, index) => <Cell key={item.nome} fill={item.fill ?? CORES[index % CORES.length]} />)}</Pie><Tooltip contentStyle={tooltipEstilo} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>
}

function GaugeVisual({ valor, meta, metric, tipo }: { valor: number; meta: number | null; metric: DashboardMetric; tipo: string }) {
  const alvo = meta ?? (metric === 'taxa_conclusao' ? 100 : Math.max(valor, 1))
  const progresso = Math.max(0, Math.min(100, (valor / alvo) * 100))
  const cor = tipo === 'traffic_light' ? (progresso >= 80 ? 'var(--verde)' : progresso >= 50 ? 'var(--ambar)' : 'var(--vermelho)') : 'var(--primaria)'
  return <div className="dashboard-gauge-visual"><div className="dashboard-gauge-head"><strong>{metric === 'taxa_conclusao' ? `${nf(valor)}%` : nf(valor)}</strong><span>meta {nf(alvo)}</span></div><div className="dashboard-gauge-track"><i style={{ width: `${progresso}%`, background: cor }} /></div><small>{nomeMetrica(metric)} · {progresso.toFixed(0)}% da meta</small></div>
}

function FlowVisual({ itens }: { itens: Categoria[] }) {
  const total = itens.reduce((acc, item) => acc + item.valor, 0) || 1
  return <div className="dashboard-flow-visual">{itens.slice(0, 6).map((item, index) => <div className="dashboard-flow-step" key={item.nome}><span>{index + 1}</span><div><b>{item.nome}</b><small>{nf(item.valor)} · {Math.round((item.valor / total) * 100)}%</small><i style={{ width: `${(item.valor / (itens[0]?.valor || 1)) * 100}%`, background: item.fill }} /></div></div>)}</div>
}

function ScatterVisual({ itens }: { itens: Categoria[] }) {
  const data = itens.map((item, index) => ({ x: index + 1, y: item.valor, nome: item.nome }))
  return <ResponsiveContainer width="100%" height={180}><ScatterChart><CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" /><XAxis type="number" dataKey="x" name="categoria" stroke="var(--txt-fraco)" fontSize={11} /><YAxis type="number" dataKey="y" name="valor" stroke="var(--txt-fraco)" fontSize={11} allowDecimals={false} /><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipEstilo} /><Scatter name="Categorias" data={data} fill="var(--primaria)" /></ScatterChart></ResponsiveContainer>
}

function HeatmapVisual({ itens }: { itens: Categoria[] }) {
  const max = itens[0]?.valor || 1
  return <div className="dashboard-heatmap">{itens.slice(0, 20).map((item) => <div key={item.nome} title={`${item.nome}: ${item.valor}`}><span>{item.nome}</span><i style={{ opacity: .16 + (item.valor / max) * .84, background: item.fill }} /></div>)}</div>
}

function HistogramVisual({ itens, boxplot = false }: { itens: Categoria[]; boxplot?: boolean }) {
  const dados = boxplot ? itens.map((item) => ({ ...item, valor: Math.max(1, Math.round(item.valor * .7)) })) : itens
  return <CategoriaVisual itens={dados} tipo="histogram" />
}

function TimelineVisual({ itens }: { itens: Categoria[] }) {
  return <div className="dashboard-timeline">{itens.slice(0, 8).map((item, index) => <div key={item.nome} className="dashboard-timeline-item"><span style={{ background: item.fill }} /><div><b>{item.nome}</b><small>{nf(item.valor)} ocorrências · etapa {index + 1}</small></div></div>)}</div>
}

function KpiGridVisual({ metricas }: { metricas: Record<DashboardMetric, number> }) {
  return <div className="dashboard-kpi-grid">{DASHBOARD_METRICS.slice(0, 6).map((item, index) => <div key={item.value}><span style={{ color: CORES[index % CORES.length] }}>{item.label}</span><strong>{item.value === 'taxa_conclusao' ? `${nf(metricas[item.value])}%` : nf(metricas[item.value])}</strong></div>)}</div>
}

function OperacaoVisual({ tipo, criticas, eventos, proximas }: { tipo: string; criticas: Pendencia[]; eventos: Evento[]; proximas: Equipamento[] }) {
  if (tipo === 'alert_list') return !criticas.length ? <Vazio texto="Nenhuma pendência prioritária" compacto /> : <ul className="lista-simples">{criticas.map((item) => <li key={item.id}><div><b>{item.titulo}</b><small>{rotulo(item.prioridade)} · {dataCurta(item.aberta_em)}</small></div><Badge tom={item.prioridade === 'critica' ? 'vermelho' : 'ambar'}>{rotulo(item.prioridade)}</Badge></li>)}</ul>
  if (tipo === 'annotation_list') return !eventos.length ? <Vazio texto="Nenhum marco no período" compacto /> : <ul className="lista-simples">{eventos.slice(0, 6).map((item, index) => <li key={`${item.data}-${index}`}><div><b>{item.titulo}</b><small>{item.detalhe}</small></div><Badge tom={item.tom}>{dataCurta(item.data)}</Badge></li>)}</ul>
  if (tipo === 'event_log') return !eventos.length ? <Vazio texto="Nenhum evento registrado" compacto /> : <div className="dashboard-event-log">{eventos.slice(0, 8).map((item, index) => <div key={`${item.data}-${index}`}><span>{dataCurta(item.data)}</span><b>{item.titulo}</b><small>{item.detalhe}</small></div>)}</div>
  return !proximas.length ? <Vazio texto="Nenhuma manutenção próxima" compacto /> : <ul className="lista-simples">{proximas.map((item) => <li key={item.id}><div><b>{item.codigo}</b><small>{item.nome}</small></div><Badge tom="azul">{dataCurta(item.proxima_manutencao)}</Badge></li>)}</ul>
}

function TabelaVisual({ equipamentos }: { equipamentos: Equipamento[] }) {
  if (!equipamentos.length) return <Vazio texto="Nenhum equipamento no recorte" compacto />
  return <div className="tabela-wrap responsiva"><table className="tabela"><thead><tr><th>Código</th><th>Equipamento</th><th>Status</th></tr></thead><tbody>{equipamentos.slice(0, 8).map((item) => <tr key={item.id}><td data-rotulo="Código"><b>{item.codigo}</b></td><td className="principal">{item.nome}</td><td data-rotulo="Status"><Badge tom={item.status === 'ativo' ? 'verde' : item.status === 'manutencao' ? 'ambar' : 'cinza'}>{rotulo(item.status)}</Badge></td></tr>)}</tbody></table></div>
}

function LinksVisual() {
  return <div className="dashboard-links-visual"><Link to="/app/checklist"><CheckCircle2 size={16} />Checklists</Link><Link to="/app/equipamentos"><Printer size={16} />Equipamentos</Link><Link to="/app/estoque"><Package size={16} />Estoque geral</Link><Link to="/app/pendencias"><TriangleAlert size={16} />Pendências</Link><Link to="/app/relatorios"><CalendarDays size={16} />Relatórios</Link></div>
}

function CanvasVisual({ dados }: { dados: DadosDashboard }) {
  return <div className="dashboard-canvas-visual"><div><Activity size={17} /><span>Ativos</span><strong>{nf(dados.metricas.equipamentos_ativos)}</strong></div><div><Clock3 size={17} /><span>Pendentes</span><strong>{nf(dados.metricas.checklists_pendentes)}</strong></div><div><Boxes size={17} /><span>Consumo</span><strong>{nf(dados.metricas.consumo_periodo)}</strong></div></div>
}

function VisualDoWidget({ widget, dados }: { widget: DashboardWidget; dados: DadosDashboard }): ReactNode {
  const valor = dados.metricas[widget.metric]
  const serie = dados.series[widget.metric]
  const categorias = dados.categorias[widget.dimension]
  const tipo = widget.type
  if (tipo === 'kpi' || tipo === 'stat' || tipo === 'sparkline' || tipo === 'delta') return <MetricVisual metric={widget.metric} valor={valor} serie={serie} tipo={tipo} />
  if (tipo === 'gauge' || tipo === 'bullet' || tipo === 'progress_ring' || tipo === 'traffic_light') return <GaugeVisual valor={valor} meta={widget.meta} metric={widget.metric} tipo={tipo} />
  if (tipo === 'line' || tipo === 'time_series' || tipo === 'trend' || tipo === 'step_line' || tipo === 'weekly_bars' || tipo === 'weekday_profile' || tipo === 'status_history' || tipo === 'state_timeline') return <LineVisual itens={serie} />
  if (tipo === 'daily_change') return <LineVisual itens={dados.serieDiaria} />
  if (tipo === 'area' || tipo === 'cumulative_line' || tipo === 'pace_chart') return <LineVisual itens={serie} area />
  if (tipo === 'combo_bar_line' || tipo === 'range_band' || tipo === 'control_chart') return <LineVisual itens={serie.map((item, index) => ({ ...item, auxiliar: Math.round(serie.slice(Math.max(0, index - 2), index + 1).reduce((sum, current) => sum + current.valor, 0) / Math.min(index + 1, 3)) }))} combo />
  if (tipo === 'pie' || tipo === 'polar_area') return <PizzaVisual itens={categorias} />
  if (tipo === 'donut') return <PizzaVisual itens={categorias} donut />
  if (tipo === 'funnel' || tipo === 'sankey' || tipo === 'conversion_steps') return <FlowVisual itens={categorias} />
  if (tipo === 'scatter' || tipo === 'xy_chart' || tipo === 'bubble' || tipo === 'seller_quadrant') return <ScatterVisual itens={categorias} />
  if (tipo === 'heatmap' || tipo === 'calendar_heatmap') return <HeatmapVisual itens={categorias} />
  if (tipo === 'histogram') return <HistogramVisual itens={categorias} />
  if (tipo === 'boxplot') return <HistogramVisual itens={categorias} boxplot />
  if (tipo === 'waterfall') return <FlowVisual itens={categorias} />
  if (tipo === 'kpi_grid') return <KpiGridVisual metricas={dados.metricas} />
  if (tipo === 'alert_list' || tipo === 'event_log' || tipo === 'annotation_list') return <OperacaoVisual tipo={tipo} criticas={dados.criticas} eventos={dados.eventos} proximas={dados.proximas} />
  if (tipo === 'table') return <TabelaVisual equipamentos={dados.equipamentos} />
  if (tipo === 'dashboard_list') return <LinksVisual />
  if (tipo === 'text') return <div className="dashboard-text-visual"><b>Contexto da operação</b><p>Este quadro usa o recorte atual da empresa, da cidade e do setor selecionados no topo.</p></div>
  if (tipo === 'canvas') return <CanvasVisual dados={dados} />
  if (tipo === 'geomap') return <CategoriaVisual itens={dados.categorias.cidade} tipo="bar" />
  return <CategoriaVisual itens={categorias} tipo={tipo} />
}

function montarDados(dados: Painelzinho): DadosDashboard {
  const concluidos = dados.checklists.filter((item) => item.status === 'concluido')
  const pendentes = dados.checklists.filter((item) => item.status === 'pendente' || item.status === 'em_andamento')
  const abertas = dados.pendencias.filter((item) => item.status === 'aberta' || item.status === 'em_andamento')
  const criticasTodas = abertas.filter((item) => item.prioridade === 'critica' || item.prioridade === 'alta')
  const criticas = criticasTodas.slice(0, 8)
  const saidas = dados.movimentacoes.filter((item) => item.tipo === 'saida')
  const proximas = dados.equipamentos.filter((item) => item.proxima_manutencao).sort((a, b) => (a.proxima_manutencao ?? '').localeCompare(b.proxima_manutencao ?? '')).slice(0, 8)
  const metricas: Record<DashboardMetric, number> = {
    equipamentos_total: dados.equipamentos.length,
    equipamentos_ativos: dados.equipamentos.filter((item) => item.status === 'ativo').length,
    checklists_total: dados.checklists.length,
    checklists_concluidos: concluidos.length,
    checklists_pendentes: pendentes.length,
    pendencias_abertas: abertas.length,
    pendencias_criticas: criticasTodas.length,
    manutencoes_proximas: proximas.length,
    consumo_periodo: saidas.reduce((sum, item) => sum + item.quantidade, 0),
    taxa_conclusao: dados.checklists.length ? (concluidos.length / dados.checklists.length) * 100 : 0,
  }

  const meses = Array.from({ length: 6 }, (_, index) => {
    const inicio = new Date(); inicio.setDate(1); inicio.setHours(0, 0, 0, 0); inicio.setMonth(inicio.getMonth() - (5 - index))
    const fim = new Date(inicio); fim.setMonth(fim.getMonth() + 1)
    return { inicio, fim, label: inicio.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }
  })
  const entre = (valor: string | null | undefined, inicio: Date, fim: Date) => !!valor && new Date(valor) >= inicio && new Date(valor) < fim
  const series: Record<DashboardMetric, Serie[]> = {
    equipamentos_total: meses.map((item) => ({ label: item.label, valor: dados.equipamentos.length })),
    equipamentos_ativos: meses.map((item) => ({ label: item.label, valor: dados.equipamentos.filter((eq) => eq.status === 'ativo').length })),
    checklists_total: meses.map((item) => ({ label: item.label, valor: dados.checklists.filter((check) => entre(check.criado_em, item.inicio, item.fim)).length })),
    checklists_concluidos: meses.map((item) => ({ label: item.label, valor: concluidos.filter((check) => entre(check.data_conclusao, item.inicio, item.fim)).length })),
    checklists_pendentes: meses.map((item) => ({ label: item.label, valor: pendentes.filter((check) => entre(check.data_prevista, item.inicio, item.fim)).length })),
    pendencias_abertas: meses.map((mes) => ({ label: mes.label, valor: abertas.filter((pendencia) => entre(pendencia.aberta_em, mes.inicio, mes.fim)).length })),
    pendencias_criticas: meses.map((mes) => ({ label: mes.label, valor: criticasTodas.filter((pendencia) => entre(pendencia.aberta_em, mes.inicio, mes.fim)).length })),
    manutencoes_proximas: meses.map((item) => ({ label: item.label, valor: proximas.filter((equipamento) => entre(equipamento.proxima_manutencao, item.inicio, item.fim)).length })),
    consumo_periodo: meses.map((item) => ({ label: item.label, valor: saidas.filter((movimento) => entre(movimento.criado_em, item.inicio, item.fim)).reduce((sum, movimento) => sum + movimento.quantidade, 0) })),
    taxa_conclusao: meses.map((item) => { const total = dados.checklists.filter((check) => entre(check.criado_em, item.inicio, item.fim)).length; const totalConcluido = concluidos.filter((check) => entre(check.data_conclusao, item.inicio, item.fim)).length; return { label: item.label, valor: total ? (totalConcluido / total) * 100 : 0 } }),
  }

  const ultimosDias = Array.from({ length: 14 }, (_, index) => {
    const dia = new Date(); dia.setHours(0, 0, 0, 0); dia.setDate(dia.getDate() - (13 - index))
    const fim = new Date(dia); fim.setDate(fim.getDate() + 1)
    return { dia, fim, label: dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
  })
  const serieDiaria = ultimosDias.map(({ dia, fim, label }) => ({ label, valor: concluidos.filter((item) => entre(item.data_conclusao, dia, fim)).length }))

  const categorias: Record<DashboardDimension, Categoria[]> = {
    setor: contar(dados.equipamentos.map((item) => item.setores?.nome ?? 'Sem setor')),
    status_equipamento: contar(dados.equipamentos.map((item) => rotulo(item.status))),
    status_checklist: contar(dados.checklists.map((item) => rotulo(item.status))),
    prioridade_pendencia: contar(dados.pendencias.map((item) => rotulo(item.prioridade))),
    tipo_checklist: contar(dados.checklists.map((item) => rotulo(item.tipo))),
    tipo_movimentacao: contar(dados.movimentacoes.map((item) => rotulo(item.tipo))),
    cidade: contar(dados.equipamentos.map((item) => item.cidades ? `${item.cidades.nome} - ${item.cidades.uf}` : 'Sem cidade')),
    material: Object.entries(saidas.reduce<Record<string, number>>((acc, item) => { const nome = item.materiais?.nome ?? 'Material'; acc[nome] = (acc[nome] ?? 0) + item.quantidade; return acc }, {})).map(([nome, valor], index) => ({ nome, valor, fill: CORES[index % CORES.length] })).sort((a, b) => b.valor - a.valor),
  }

  const eventos: Evento[] = [
    ...dados.checklists.map((item) => ({ data: item.data_conclusao ?? item.criado_em, titulo: item.titulo, detalhe: `Checklist ${rotulo(item.status)}`, tom: item.status === 'concluido' ? 'verde' : 'azul' })),
    ...dados.pendencias.map((item) => ({ data: item.aberta_em, titulo: item.titulo, detalhe: `Pendência ${rotulo(item.prioridade)}`, tom: item.prioridade === 'critica' ? 'vermelho' : 'ambar' })),
    ...dados.movimentacoes.map((item) => ({ data: item.criado_em, titulo: item.materiais?.nome ?? 'Movimentação', detalhe: `${rotulo(item.tipo)} · ${nf(item.quantidade)} itens`, tom: item.tipo === 'saida' ? 'roxo' : 'azul' })),
  ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12)

  return { ...dados, metricas, categorias, series, serieDiaria, proximas, criticas, eventos }
}

export default function Dashboard() {
  const { cidadeId, cidadeAtual, setorId, empresaId } = useApp()
  const { dados: dadosBrutos, carregando, erro, recarregar } = useConsulta<Painelzinho>(async () => {
    const filtroCidade = <T,>(query: T) => cidadeId ? (query as any).eq('cidade_id', cidadeId) : query
    const [equipamentos, checklists, pendencias, movimentacoes] = await Promise.all([
      filtroCidade(supabase.from('equipamentos').select('*, setores(id, nome), cidades(id, nome, uf)')),
      supabase.from('checklists').select('*, equipamentos(id, codigo, nome, cidade_id)').order('data_prevista', { ascending: false }),
      filtroCidade(supabase.from('pendencias').select('*, equipamentos(id, codigo, nome)')),
      filtroCidade(supabase.from('movimentacoes').select('*, materiais(id, codigo, nome, unidade)').order('criado_em', { ascending: false })),
    ])
    const listaEquipamentos = ((equipamentos.data ?? []) as Equipamento[]).filter((item) => !setorId || item.setor_id === setorId)
    const idsEquipamentos = new Set(listaEquipamentos.map((item) => item.id))
    return {
      equipamentos: listaEquipamentos,
      checklists: ((checklists.data ?? []) as Checklist[]).filter((item) => idsEquipamentos.has(item.equipamento_id)),
      pendencias: (pendencias.data ?? []) as Pendencia[],
      movimentacoes: (movimentacoes.data ?? []) as Movimentacao[],
    }
  }, [cidadeId, setorId])

  const { dados: layoutSalvo, carregando: carregandoLayout, erro: erroLayout, recarregar: recarregarLayout } = useConsulta<DashboardLayout>(async () => {
    if (!empresaId) return DASHBOARD_LAYOUT_PADRAO
    const { data, error } = await supabase.from('dashboard_configuracoes').select('layout').eq('empresa_id', empresaId).maybeSingle()
    if (error) throw error
    return normalizarDashboardLayout((data as { layout?: unknown } | null)?.layout)
  }, [empresaId])

  const dados = useMemo(() => montarDados(dadosBrutos ?? { equipamentos: [], checklists: [], pendencias: [], movimentacoes: [] }), [dadosBrutos])
  const layout = layoutSalvo ?? DASHBOARD_LAYOUT_PADRAO
  const visiveis = layout.widgets.filter((widget) => widget.visivel)

  if (carregando || carregandoLayout) return <section><div className="title-row"><h1>Dashboard</h1></div><Skeleton linhas={8} /></section>

  return <section>
    <div className="title-row"><div><h1>Dashboard</h1><p>{cidadeAtual ? `${cidadeAtual.nome} - ${cidadeAtual.uf}` : 'Todas as cidades'}{setorId ? ' · setor selecionado' : ''} · período atual</p></div><Badge tom="verde">{nf(dados.metricas.equipamentos_ativos)}/{nf(dados.metricas.equipamentos_total)} equipamentos ativos</Badge></div>
    {(erro || erroLayout) && <ErroDados recarregar={async () => { await Promise.all([recarregar(), recarregarLayout()]) }} texto={erroLayout ? 'Não foi possível carregar a configuração do dashboard. Exibindo o padrão.' : undefined} />}
    {!visiveis.length ? <Vazio texto="Nenhum quadro visível. Abra Configurações › Dashboard para adicionar visuais." /> : <div className="dashboard-grid dashboard-personalizado">{visiveis.map((widget) => <Painel key={widget.id} titulo={widget.titulo || catalogoDoDashboard(widget.type).label} className={`dashboard-widget dashboard-widget--${widget.largura}`}><VisualDoWidget widget={widget} dados={dados} /></Painel>)}</div>}
  </section>
}
