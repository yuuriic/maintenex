import { useMemo, useState } from 'react'
import {
  Activity, ArrowDown, ArrowUp, BarChart3, Eye, EyeOff, Gauge, GripVertical, LayoutDashboard,
  List, PieChart, Plus, RotateCcw, Save, Search, SlidersHorizontal, Table2, Target, Trash2, TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from './ui'
import {
  DASHBOARD_CATALOG, DASHBOARD_DIMENSIONS, DASHBOARD_METRICS, DASHBOARD_LAYOUT_PADRAO,
  MAX_DASHBOARD_WIDGETS, catalogoDoDashboard, novoWidget,
  type DashboardDimension, type DashboardLayout, type DashboardMetric, type DashboardWidget, type DashboardWidgetType,
  type DashboardWidth,
} from '../lib/dashboard-config'

const FAMILIAS = [...new Set(DASHBOARD_CATALOG.map((item) => item.family))]
const rotuloFamilia: Record<string, string> = {
  scorecard: 'Indicadores', trend: 'Tendências', comparison: 'Comparação', composition: 'Composição',
  progression: 'Progressão', relationship: 'Relações', matrix: 'Matrizes', distribution: 'Distribuição',
  benchmark: 'Metas', decomposition: 'Decomposição', timeline: 'Linha do tempo', financial: 'Financeiro',
  custom: 'Personalizados', geospatial: 'Geográfico', detail: 'Detalhamento', operations: 'Operações',
}

interface Props {
  layout: DashboardLayout
  salvando: boolean
  erro: string | null
  onChange: (layout: DashboardLayout) => void
  onSalvar: () => void
}

function atualizarWidget(layout: DashboardLayout, id: string, patch: Partial<DashboardWidget>) {
  return {
    ...layout,
    widgets: layout.widgets.map((widget) => widget.id === id ? { ...widget, ...patch } : widget),
  }
}

const iconesFamilia: Record<string, LucideIcon> = {
  scorecard: Gauge,
  trend: Activity,
  comparison: BarChart3,
  composition: PieChart,
  progression: TrendingUp,
  benchmark: Target,
  detail: Table2,
  operations: List,
  custom: SlidersHorizontal,
}

function IconeFamilia({ familia, size = 16 }: { familia: string; size?: number }) {
  const Icone = iconesFamilia[familia] ?? BarChart3
  return <Icone size={size} strokeWidth={2} />
}

function nomeMetrica(metric: DashboardMetric) {
  return DASHBOARD_METRICS.find((item) => item.value === metric)?.label ?? metric
}

function nomeDimensao(dimension: DashboardDimension) {
  return DASHBOARD_DIMENSIONS.find((item) => item.value === dimension)?.label ?? dimension
}

function VisualPreview({ familia, compacto = false }: { familia: string; compacto?: boolean }) {
  return (
    <div className={`dashboard-visual-preview dashboard-visual-preview--${familia} ${compacto ? 'compacto' : ''}`} aria-hidden="true">
      <span className="dashboard-visual-preview-icon"><IconeFamilia familia={familia} size={compacto ? 15 : 18} /></span>
      <span className="dashboard-visual-preview-sample"><i /><i /><i /><i /></span>
    </div>
  )
}

export default function DashboardCustomizer({ layout, salvando, erro, onChange, onSalvar }: Props) {
  const [busca, setBusca] = useState('')
  const [familia, setFamilia] = useState('todas')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const termos = busca.trim().toLocaleLowerCase('pt-BR')
  const catalogoFiltrado = useMemo(() => DASHBOARD_CATALOG.filter((item) => {
    const correspondeFamilia = familia === 'todas' || item.family === familia
    const texto = `${item.label} ${item.description} ${item.family}`.toLocaleLowerCase('pt-BR')
    return correspondeFamilia && (!termos || texto.includes(termos))
  }), [familia, termos])

  function mover(index: number, direcao: -1 | 1) {
    const destino = index + direcao
    if (destino < 0 || destino >= layout.widgets.length) return
    const widgets = [...layout.widgets]
    ;[widgets[index], widgets[destino]] = [widgets[destino], widgets[index]]
    onChange({ ...layout, widgets })
  }

  function adicionar(type: DashboardWidgetType) {
    if (layout.widgets.length >= MAX_DASHBOARD_WIDGETS) return
    const widget = novoWidget(type, layout.widgets.length)
    onChange({ ...layout, widgets: [...layout.widgets, widget] })
    setSelecionadoId(widget.id)
  }

  function alterarTipo(widget: DashboardWidget, type: DashboardWidgetType) {
    const anterior = catalogoDoDashboard(widget.type).label
    const proximo = catalogoDoDashboard(type).label
    onChange(atualizarWidget(layout, widget.id, {
      type,
      titulo: widget.titulo === anterior ? proximo : widget.titulo,
    }))
  }

  function remover(id: string) {
    const indice = layout.widgets.findIndex((widget) => widget.id === id)
    const restantes = layout.widgets.filter((widget) => widget.id !== id)
    if (selecionadoId === id) setSelecionadoId(restantes[Math.min(indice, restantes.length - 1)]?.id ?? null)
    onChange({ ...layout, widgets: restantes })
  }

  function restaurarPadrao() {
    onChange({ ...DASHBOARD_LAYOUT_PADRAO, widgets: DASHBOARD_LAYOUT_PADRAO.widgets.map((widget) => ({ ...widget })) })
    setSelecionadoId(null)
  }

  const widgetSelecionado = layout.widgets.find((widget) => widget.id === selecionadoId) ?? layout.widgets[0] ?? null
  const indiceSelecionado = widgetSelecionado ? layout.widgets.findIndex((widget) => widget.id === widgetSelecionado.id) + 1 : 0

  function alterarSelecionado(patch: Partial<DashboardWidget>) {
    if (widgetSelecionado) onChange(atualizarWidget(layout, widgetSelecionado.id, patch))
  }

  return (
    <div className="dashboard-customizer dashboard-builder-experience">
      <header className="dashboard-builder-toolbar">
        <div className="dashboard-builder-toolbar-title">
          <span className="dashboard-customizer-icon"><LayoutDashboard size={19} /></span>
          <div>
            <span className="dashboard-section-kicker">Personalização da empresa</span>
            <h2>Dashboard</h2>
            <p>Escolha os visuais, confira os dados e organize os quadros antes de salvar.</p>
          </div>
        </div>
        <div className="dashboard-customizer-actions">
          <span className="dashboard-widget-count">{layout.widgets.length}/{MAX_DASHBOARD_WIDGETS}</span>
          <Badge tom="azul">{layout.widgets.filter((widget) => widget.visivel).length} ativos</Badge>
          <button className="btn" type="button" disabled={salvando} onClick={restaurarPadrao}>
            <RotateCcw size={15} />Restaurar padrão
          </button>
          <button className="btn primario" type="button" disabled={salvando} onClick={onSalvar}>
            <Save size={15} />{salvando ? 'Salvando…' : 'Salvar dashboard'}
          </button>
        </div>
      </header>

      <div className="dashboard-customizer-help">
        <span className="dashboard-customizer-help-icon"><LayoutDashboard size={16} /></span>
        <strong>Biblioteca SalesOps + Grafana</strong>
        <span>Os 62 visuais foram adaptados para os dados de manutenção e continuam protegidos pelo escopo da empresa.</span>
      </div>
      {erro && <div className="alerta erro" role="alert">{erro}</div>}

      <div className="dashboard-builder-columns">
        <aside className="dashboard-library-panel" aria-label="Escolha os visuais">
          <div className="dashboard-panel-heading">
            <div>
              <span className="dashboard-section-kicker">Catálogo visual</span>
              <h3>Escolha os visuais</h3>
              <p>Adicione um ou vários quadros. Catálogo com 62 opções.</p>
            </div>
            <span className="dashboard-library-count">{DASHBOARD_CATALOG.length} disponíveis</span>
          </div>

          <div className="dashboard-family-pills" aria-label="Famílias de visuais">
            <button className={familia === 'todas' ? 'ativo' : ''} type="button" onClick={() => setFamilia('todas')}>Todos</button>
            {FAMILIAS.slice(0, 8).map((item) => <button className={familia === item ? 'ativo' : ''} type="button" key={item} onClick={() => setFamilia(item)}>{rotuloFamilia[item] ?? item}</button>)}
          </div>

          <label className="campo dashboard-library-search">
            <span className="sr-only">Buscar visual</span>
            <div className="campo-input"><Search size={15} /><input aria-label="Buscar visual" placeholder="Buscar em todos os visuais" value={busca} onChange={(event) => setBusca(event.target.value)} /></div>
          </label>

          <div className="dashboard-library-items">
            {catalogoFiltrado.map((item) => {
              const adicionado = layout.widgets.some((widget) => widget.type === item.type)
              return (
                <button className={`dashboard-library-card ${adicionado ? 'adicionado' : ''}`} type="button" key={item.type} disabled={salvando || layout.widgets.length >= MAX_DASHBOARD_WIDGETS} onClick={() => adicionar(item.type)} title={item.description}>
                  <VisualPreview familia={item.family} compacto />
                  <span className="dashboard-library-card-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                  <span className="dashboard-library-card-action">{adicionado ? 'Adicionado' : 'Adicionar'}{adicionado ? <Eye size={14} /> : <Plus size={14} />}</span>
                </button>
              )
            })}
            {!catalogoFiltrado.length && <div className="paleta-vazio">Nenhum visual encontrado.</div>}
          </div>
          {layout.widgets.length >= MAX_DASHBOARD_WIDGETS && <small className="dashboard-limit-note">Limite de {MAX_DASHBOARD_WIDGETS} quadros ativos para manter o plano free rápido.</small>}
        </aside>

        <section className="dashboard-preview-panel" aria-label="Prévia do painel">
          <div className="dashboard-panel-heading dashboard-preview-panel-heading">
            <div>
              <span className="dashboard-section-kicker">Prévia do painel</span>
              <h3>{layout.widgets.filter((widget) => widget.visivel).length} quadros selecionados</h3>
            </div>
            <small>Clique para configurar · use as setas para ordenar</small>
          </div>

          {!layout.widgets.length ? <div className="dashboard-preview-empty"><LayoutDashboard size={24} /><strong>Seu painel começa aqui</strong><span>Escolha um visual na biblioteca para criar o primeiro quadro.</span></div> : (
            <div className="dashboard-preview-canvas">
              {layout.widgets.map((widget, index) => {
                const catalogo = catalogoDoDashboard(widget.type)
                const selecionado = widgetSelecionado?.id === widget.id
                return (
                  <article className={`dashboard-preview-widget dashboard-preview-widget--${widget.largura} ${selecionado ? 'selecionado' : ''} ${widget.visivel ? '' : 'oculto'}`} key={widget.id}>
                    <button className="dashboard-preview-widget-main" type="button" aria-pressed={selecionado} onClick={() => setSelecionadoId(widget.id)}>
                      <span className="dashboard-preview-drag"><GripVertical size={16} /></span>
                      <VisualPreview familia={catalogo.family} />
                      <span className="dashboard-preview-widget-copy"><strong>{widget.titulo}</strong><small>{catalogo.label} · {nomeMetrica(widget.metric)} · {nomeDimensao(widget.dimension)}</small></span>
                      {!widget.visivel && <span className="dashboard-preview-hidden">Oculto</span>}
                    </button>
                    <div className="dashboard-preview-widget-actions">
                      <span>Quadro {index + 1}</span>
                      <button className="icone-btn" type="button" aria-label={`Mover ${catalogo.label} para cima`} disabled={index === 0 || salvando} onClick={() => mover(index, -1)}><ArrowUp size={15} /></button>
                      <button className="icone-btn" type="button" aria-label={`Mover ${catalogo.label} para baixo`} disabled={index === layout.widgets.length - 1 || salvando} onClick={() => mover(index, 1)}><ArrowDown size={15} /></button>
                      <button className="icone-btn" type="button" aria-label={widget.visivel ? `Ocultar ${catalogo.label}` : `Mostrar ${catalogo.label}`} disabled={salvando} onClick={() => onChange(atualizarWidget(layout, widget.id, { visivel: !widget.visivel }))}>
                        {widget.visivel ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <button className="icone-btn perigo" type="button" aria-label={`Remover ${catalogo.label}`} disabled={salvando} onClick={() => remover(widget.id)}><Trash2 size={15} /></button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="dashboard-settings-panel" aria-label="Configuração do quadro">
          <div className="dashboard-panel-heading">
            <div>
              <span className="dashboard-section-kicker">Configuração</span>
              <h3>Propriedades do quadro</h3>
              <p>Selecione um quadro na prévia para editar seus dados.</p>
            </div>
          </div>

          {!widgetSelecionado ? <div className="dashboard-settings-empty">Nenhum quadro selecionado.</div> : (() => {
            const catalogo = catalogoDoDashboard(widgetSelecionado.type)
            return (
              <div className="dashboard-settings-form">
                <div className="dashboard-selected-widget">
                  <VisualPreview familia={catalogo.family} compacto />
                  <div><small>Quadro selecionado</small><strong>{catalogo.label}</strong><span>{nomeMetrica(widgetSelecionado.metric)} · {nomeDimensao(widgetSelecionado.dimension)}</span></div>
                </div>

                <label className="campo"><span>Título exibido</span><input aria-label={`Título do quadro ${indiceSelecionado}`} maxLength={80} value={widgetSelecionado.titulo} disabled={salvando} onChange={(event) => alterarSelecionado({ titulo: event.target.value })} /></label>
                <label className="campo"><span>Visual</span><select aria-label={`Visual do quadro ${indiceSelecionado}`} value={widgetSelecionado.type} disabled={salvando} onChange={(event) => alterarTipo(widgetSelecionado, event.target.value as DashboardWidgetType)}>
                  {!DASHBOARD_CATALOG.some((item) => item.type === widgetSelecionado.type) && <option value={widgetSelecionado.type}>{catalogo.label} (nativo)</option>}
                  {DASHBOARD_CATALOG.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
                </select></label>
                <label className="campo"><span>Dados apresentados</span><select aria-label={`Dados do quadro ${indiceSelecionado}`} value={widgetSelecionado.metric} disabled={salvando} onChange={(event) => alterarSelecionado({ metric: event.target.value as DashboardMetric })}>
                  {DASHBOARD_METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select></label>
                <label className="campo"><span>Agrupar por</span><select aria-label={`Dimensão do quadro ${indiceSelecionado}`} value={widgetSelecionado.dimension} disabled={salvando} onChange={(event) => alterarSelecionado({ dimension: event.target.value as DashboardDimension })}>
                  {DASHBOARD_DIMENSIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select></label>
                <label className="campo"><span>Largura no painel</span><select aria-label={`Largura do quadro ${indiceSelecionado}`} value={widgetSelecionado.largura} disabled={salvando} onChange={(event) => alterarSelecionado({ largura: event.target.value as DashboardWidth })}>
                  <option value="terco">1/3 da linha</option><option value="meio">1/2 da linha</option><option value="full">Linha inteira</option>
                </select></label>
                <label className="campo"><span>Meta opcional</span><input aria-label={`Meta do quadro ${indiceSelecionado}`} type="number" min="0" step="0.01" value={widgetSelecionado.meta ?? ''} disabled={salvando} onChange={(event) => alterarSelecionado({ meta: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                <label className="campo"><span>Visibilidade</span><select aria-label={`Visibilidade do quadro ${indiceSelecionado}`} value={widgetSelecionado.visivel ? 'visivel' : 'oculto'} disabled={salvando} onChange={(event) => alterarSelecionado({ visivel: event.target.value === 'visivel' })}>
                  <option value="visivel">Visível para a empresa</option><option value="oculto">Oculto no Dashboard</option>
                </select></label>

                <div className="dashboard-settings-data"><strong>Dados apresentados</strong><span>{nomeMetrica(widgetSelecionado.metric)} · {nomeDimensao(widgetSelecionado.dimension)}. Os filtros de período continuam disponíveis no painel.</span></div>
              </div>
            )
          })()}
        </aside>
      </div>
    </div>
  )
}
