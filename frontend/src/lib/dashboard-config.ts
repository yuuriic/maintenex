export const DASHBOARD_CATALOG = [
  { type: 'kpi', label: 'KPI', family: 'scorecard', description: 'Valor único com contexto do período.' },
  { type: 'stat', label: 'Estatística', family: 'scorecard', description: 'Estatística única com série auxiliar.' },
  { type: 'line', label: 'Linha', family: 'trend', description: 'Evolução de uma métrica ao longo do tempo.' },
  { type: 'time_series', label: 'Série temporal', family: 'trend', description: 'Série temporal com pontos e escala.' },
  { type: 'trend', label: 'Tendência', family: 'trend', description: 'Direção e variação do indicador.' },
  { type: 'area', label: 'Área', family: 'trend', description: 'Magnitude acumulada ao longo do período.' },
  { type: 'bar', label: 'Barras', family: 'comparison', description: 'Comparação entre categorias.' },
  { type: 'bar_gauge', label: 'Medidor de barras', family: 'comparison', description: 'Valor comparado em escala horizontal.' },
  { type: 'stacked_bar', label: 'Barras empilhadas', family: 'composition', description: 'Composição por categoria e série.' },
  { type: 'pie', label: 'Pizza', family: 'composition', description: 'Participação do total.' },
  { type: 'donut', label: 'Rosca', family: 'composition', description: 'Participação do total com centro contextual.' },
  { type: 'funnel', label: 'Funil', family: 'progression', description: 'Queda ordenada entre etapas.' },
  { type: 'ranking', label: 'Ranking', family: 'comparison', description: 'Top-N ordenado por uma métrica.' },
  { type: 'scatter', label: 'Dispersão', family: 'relationship', description: 'Relação entre duas medidas.' },
  { type: 'xy_chart', label: 'XY', family: 'relationship', description: 'Pontos em eixos X e Y.' },
  { type: 'heatmap', label: 'Mapa de calor', family: 'matrix', description: 'Intensidade em duas dimensões.' },
  { type: 'histogram', label: 'Histograma', family: 'distribution', description: 'Distribuição de valores em faixas.' },
  { type: 'gauge', label: 'Medidor', family: 'benchmark', description: 'Valor contra meta ou faixa.' },
  { type: 'waterfall', label: 'Cascata', family: 'decomposition', description: 'Contribuições que levam do início ao fim.' },
  { type: 'state_timeline', label: 'Timeline de estados', family: 'timeline', description: 'Estado de uma série no tempo.' },
  { type: 'status_history', label: 'Histórico de status', family: 'timeline', description: 'Mudanças de status no período.' },
  { type: 'candlestick', label: 'Candlestick', family: 'financial', description: 'Leitura OHLC adaptada ao histórico operacional.' },
  { type: 'canvas', label: 'Canvas', family: 'custom', description: 'Composição livre de elementos do painel.' },
  { type: 'geomap', label: 'Geomapa', family: 'geospatial', description: 'Distribuição por cidades do escopo.' },
  { type: 'table', label: 'Tabela', family: 'detail', description: 'Consulta detalhada com acesso aos registros.' },
  { type: 'step_line', label: 'Linha em degraus', family: 'trend', description: 'Série que muda em patamares.' },
  { type: 'cumulative_line', label: 'Acumulado', family: 'trend', description: 'Soma corrida da métrica.' },
  { type: 'combo_bar_line', label: 'Combo barras + linha', family: 'trend', description: 'Volume em barras com linha auxiliar.' },
  { type: 'sparkline', label: 'Sparkline', family: 'scorecard', description: 'Valor atual com série recente.' },
  { type: 'delta', label: 'Variação', family: 'scorecard', description: 'Valor atual contra o período anterior.' },
  { type: 'bubble', label: 'Bolhas', family: 'relationship', description: 'Pontos com raio proporcional ao volume.' },
  { type: 'boxplot', label: 'Boxplot', family: 'distribution', description: 'Mediana, quartis e extremos.' },
  { type: 'calendar_heatmap', label: 'Calendário de calor', family: 'matrix', description: 'Intensidade por dia do período.' },
  { type: 'lollipop', label: 'Pirulito', family: 'comparison', description: 'Comparação por categoria.' },
  { type: 'dot_plot', label: 'Pontos por categoria', family: 'comparison', description: 'Valores contra a média do recorte.' },
  { type: 'pareto', label: 'Pareto', family: 'comparison', description: 'Barras ordenadas e participação acumulada.' },
  { type: 'diverging_bar', label: 'Barras divergentes', family: 'comparison', description: 'Desvio de cada categoria em relação à média.' },
  { type: 'radar', label: 'Radar', family: 'comparison', description: 'Perfil de categorias em eixos radiais.' },
  { type: 'treemap', label: 'Treemap', family: 'composition', description: 'Participação por área proporcional.' },
  { type: 'share_bar', label: 'Barra de participação', family: 'composition', description: 'Composição do total em 100%.' },
  { type: 'word_cloud', label: 'Nuvem de categorias', family: 'composition', description: 'Categorias dimensionadas pelo volume.' },
  { type: 'sankey', label: 'Sankey', family: 'progression', description: 'Fluxo entre estados da operação.' },
  { type: 'bullet', label: 'Bullet', family: 'benchmark', description: 'Realizado, meta e faixas de referência.' },
  { type: 'text', label: 'Texto', family: 'custom', description: 'Nota ou instrução dentro do painel.' },
  { type: 'dashboard_list', label: 'Lista de painéis', family: 'custom', description: 'Atalhos para áreas do Maintenex.' },
  { type: 'daily_change', label: 'Variação diária', family: 'trend', description: 'Ganho ou perda de um dia para o outro.' },
  { type: 'weekly_bars', label: 'Volume por semana', family: 'trend', description: 'Série consolidada em semanas.' },
  { type: 'range_band', label: 'Banda semanal', family: 'trend', description: 'Mínimo, média e máximo por semana.' },
  { type: 'control_chart', label: 'Carta de controle', family: 'trend', description: 'Série com média e limites de controle.' },
  { type: 'weekday_profile', label: 'Perfil por dia da semana', family: 'distribution', description: 'Concentração de volume na semana.' },
  { type: 'pace_chart', label: 'Ritmo vs meta', family: 'benchmark', description: 'Acumulado real contra ritmo necessário.' },
  { type: 'progress_ring', label: 'Anel de progresso', family: 'benchmark', description: 'Percentual da meta alcançado.' },
  { type: 'traffic_light', label: 'Semáforo de meta', family: 'benchmark', description: 'Leitura semafórica do indicador.' },
  { type: 'gauge_grid', label: 'Medidores por categoria', family: 'benchmark', description: 'Um medidor para cada categoria.' },
  { type: 'kpi_grid', label: 'Painel de indicadores', family: 'scorecard', description: 'Vários indicadores em uma grade.' },
  { type: 'conversion_steps', label: 'Conversão entre etapas', family: 'progression', description: 'Taxa de passagem entre etapas.' },
  { type: 'top_bottom', label: 'Melhores e piores', family: 'comparison', description: 'Extremos do ranking lado a lado.' },
  { type: 'polar_area', label: 'Rosa polar', family: 'composition', description: 'Categorias em setores radiais.' },
  { type: 'waffle', label: 'Waffle', family: 'composition', description: 'Participação em uma grade de cem células.' },
  { type: 'circle_pack', label: 'Círculos proporcionais', family: 'composition', description: 'Volume como área de círculo.' },
  { type: 'seller_quadrant', label: 'Quadrante de responsáveis', family: 'relationship', description: 'Volume contra conclusão por responsável.' },
  { type: 'sla_ranking', label: 'Ranking de prazo', family: 'comparison', description: 'Percentual de conclusão dentro do prazo.' },
] as const

/* Blocos operacionais internos: mantêm o catálogo SalesOps com 62 opções. */
const DASHBOARD_SYSTEM_CATALOG = [
  { type: 'alert_list', label: 'Alertas da operação', family: 'operations', description: 'Pendências prioritárias do recorte.' },
  { type: 'event_log', label: 'Trilha de eventos', family: 'operations', description: 'Atividades recentes da operação.' },
  { type: 'annotation_list', label: 'Marcos do período', family: 'operations', description: 'Marcos recentes do período.' },
] as const

export type DashboardWidgetType = typeof DASHBOARD_CATALOG[number]['type'] | typeof DASHBOARD_SYSTEM_CATALOG[number]['type']
export type DashboardFamily = typeof DASHBOARD_CATALOG[number]['family']
export type DashboardWidth = 'full' | 'meio' | 'terco'

export const DASHBOARD_METRICS = [
  { value: 'equipamentos_total', label: 'Equipamentos cadastrados' },
  { value: 'equipamentos_ativos', label: 'Equipamentos ativos' },
  { value: 'checklists_total', label: 'Checklists no recorte' },
  { value: 'checklists_concluidos', label: 'Checklists concluídos' },
  { value: 'checklists_pendentes', label: 'Checklists pendentes' },
  { value: 'pendencias_abertas', label: 'Pendências abertas' },
  { value: 'pendencias_criticas', label: 'Pendências críticas' },
  { value: 'manutencoes_proximas', label: 'Próximas manutenções' },
  { value: 'consumo_periodo', label: 'Itens consumidos no período' },
  { value: 'taxa_conclusao', label: 'Taxa de conclusão' },
] as const
export type DashboardMetric = typeof DASHBOARD_METRICS[number]['value']

export const DASHBOARD_DIMENSIONS = [
  { value: 'setor', label: 'Setor' },
  { value: 'status_equipamento', label: 'Status do equipamento' },
  { value: 'status_checklist', label: 'Status do checklist' },
  { value: 'prioridade_pendencia', label: 'Prioridade da pendência' },
  { value: 'tipo_checklist', label: 'Tipo de checklist' },
  { value: 'tipo_movimentacao', label: 'Tipo de movimentação' },
  { value: 'cidade', label: 'Cidade' },
  { value: 'material', label: 'Material' },
] as const
export type DashboardDimension = typeof DASHBOARD_DIMENSIONS[number]['value']

export interface DashboardWidget {
  id: string
  type: DashboardWidgetType
  titulo: string
  metric: DashboardMetric
  dimension: DashboardDimension
  largura: DashboardWidth
  visivel: boolean
  meta: number | null
}

export interface DashboardLayout {
  versao: 1
  widgets: DashboardWidget[]
}

export const MAX_DASHBOARD_WIDGETS = 24
export const DASHBOARD_WIDGET_TYPES = new Set<string>([
  ...DASHBOARD_CATALOG.map((item) => item.type),
  ...DASHBOARD_SYSTEM_CATALOG.map((item) => item.type),
])
const METRICS = new Set<string>(DASHBOARD_METRICS.map((item) => item.value))
const DIMENSIONS = new Set<string>(DASHBOARD_DIMENSIONS.map((item) => item.value))
const WIDTHS = new Set<DashboardWidth>(['full', 'meio', 'terco'])

export function catalogoDoDashboard(type: DashboardWidgetType) {
  return DASHBOARD_CATALOG.find((item) => item.type === type)
    ?? DASHBOARD_SYSTEM_CATALOG.find((item) => item.type === type)
    ?? DASHBOARD_CATALOG[0]
}

function novoId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function novoWidget(type: DashboardWidgetType = 'kpi', index = 0): DashboardWidget {
  const catalogo = catalogoDoDashboard(type)
  return {
    id: novoId(),
    type,
    titulo: catalogo.label,
    metric: index % 2 ? 'checklists_concluidos' : 'equipamentos_ativos',
    dimension: 'setor',
    largura: catalogo.family === 'trend' ? 'meio' : 'terco',
    visivel: true,
    meta: null,
  }
}

export const DASHBOARD_LAYOUT_PADRAO: DashboardLayout = {
  versao: 1,
  widgets: [
    { ...novoWidget('kpi', 0), id: 'padrao-ativos', titulo: 'Equipamentos ativos', metric: 'equipamentos_ativos', largura: 'terco' },
    { ...novoWidget('stat', 1), id: 'padrao-checklists', titulo: 'Checklists concluídos', metric: 'checklists_concluidos', largura: 'terco' },
    { ...novoWidget('gauge', 2), id: 'padrao-conclusao', titulo: 'Taxa de conclusão', metric: 'taxa_conclusao', largura: 'terco', meta: 100 },
    { ...novoWidget('line', 3), id: 'padrao-evolucao', titulo: 'Evolução de checklists', metric: 'checklists_concluidos', largura: 'meio' },
    { ...novoWidget('bar', 4), id: 'padrao-setores', titulo: 'Equipamentos por setor', metric: 'equipamentos_total', dimension: 'setor', largura: 'meio' },
    { ...novoWidget('donut', 5), id: 'padrao-status', titulo: 'Status dos equipamentos', metric: 'equipamentos_total', dimension: 'status_equipamento', largura: 'meio' },
    { ...novoWidget('ranking', 6), id: 'padrao-materiais', titulo: 'Materiais mais consumidos', metric: 'consumo_periodo', dimension: 'material', largura: 'meio' },
    { ...novoWidget('alert_list', 7), id: 'padrao-alertas', titulo: 'Pendências prioritárias', metric: 'pendencias_criticas', largura: 'full' },
  ],
}

function clonarLayout(layout: DashboardLayout): DashboardLayout {
  return { versao: 1, widgets: layout.widgets.map((widget) => ({ ...widget })) }
}

export function normalizarDashboardLayout(valor: unknown): DashboardLayout {
  if (!valor || typeof valor !== 'object' || !Array.isArray((valor as { widgets?: unknown }).widgets)) {
    return clonarLayout(DASHBOARD_LAYOUT_PADRAO)
  }

  const vistos = new Set<string>()
  const widgets = ((valor as { widgets: unknown[] }).widgets).slice(0, MAX_DASHBOARD_WIDGETS).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const bruto = item as Partial<DashboardWidget>
    const type = typeof bruto.type === 'string' && DASHBOARD_WIDGET_TYPES.has(bruto.type)
      ? bruto.type as DashboardWidgetType : 'kpi'
    const metric = typeof bruto.metric === 'string' && METRICS.has(bruto.metric)
      ? bruto.metric as DashboardMetric : 'equipamentos_ativos'
    const dimension = typeof bruto.dimension === 'string' && DIMENSIONS.has(bruto.dimension)
      ? bruto.dimension as DashboardDimension : 'setor'
    const largura = typeof bruto.largura === 'string' && WIDTHS.has(bruto.largura as DashboardWidth)
      ? bruto.largura as DashboardWidth : 'meio'
    const id = typeof bruto.id === 'string' && bruto.id.trim() && !vistos.has(bruto.id) ? bruto.id : novoId()
    vistos.add(id)
    const catalogo = catalogoDoDashboard(type)
    return [{
      id,
      type,
      titulo: typeof bruto.titulo === 'string' && bruto.titulo.trim() ? bruto.titulo.trim().slice(0, 80) : catalogo.label,
      metric,
      dimension,
      largura,
      visivel: bruto.visivel !== false,
      meta: typeof bruto.meta === 'number' && Number.isFinite(bruto.meta) ? bruto.meta : null,
    }]
  })

  return { versao: 1, widgets: widgets.length ? widgets : clonarLayout(DASHBOARD_LAYOUT_PADRAO).widgets }
}
