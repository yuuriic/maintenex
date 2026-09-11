import { useMemo, useState } from 'react'
import {
  ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, LayoutDashboard, Plus, RotateCcw, Save, Search, Trash2,
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

export default function DashboardCustomizer({ layout, salvando, erro, onChange, onSalvar }: Props) {
  const [busca, setBusca] = useState('')
  const [familia, setFamilia] = useState('todas')
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
    onChange({ ...layout, widgets: [...layout.widgets, novoWidget(type, layout.widgets.length)] })
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
    onChange({ ...layout, widgets: layout.widgets.filter((widget) => widget.id !== id) })
  }

  return (
    <div className="dashboard-customizer">
      <div className="dashboard-customizer-head">
        <div className="dashboard-customizer-title">
          <span className="dashboard-customizer-icon"><LayoutDashboard size={18} /></span>
          <div>
            <h2>Dashboard da operação</h2>
            <p>Escolha os quadros, os dados, o tamanho e a ordem. A configuração vale para toda a empresa.</p>
          </div>
        </div>
        <div className="dashboard-customizer-actions">
          <Badge tom="azul">{layout.widgets.filter((widget) => widget.visivel).length} ativos</Badge>
          <button className="btn" type="button" disabled={salvando} onClick={() => onChange({ ...DASHBOARD_LAYOUT_PADRAO, widgets: DASHBOARD_LAYOUT_PADRAO.widgets.map((widget) => ({ ...widget })) })}>
            <RotateCcw size={15} />Restaurar padrão
          </button>
          <button className="btn primario" type="button" disabled={salvando} onClick={onSalvar}>
            <Save size={15} />{salvando ? 'Salvando…' : 'Salvar dashboard'}
          </button>
        </div>
      </div>

      <div className="dashboard-customizer-help">
        <strong>Biblioteca SalesOps + Grafana</strong>
        <span>Os 62 visuais foram adaptados para os dados de manutenção e continuam protegidos pelo escopo da empresa.</span>
      </div>
      {erro && <div className="alerta erro" role="alert">{erro}</div>}

      <div className="dashboard-customizer-grid">
        <section className="dashboard-builder-list" aria-label="Quadros configurados">
          <div className="dashboard-builder-section-head">
            <div><h3>Quadros do dashboard</h3><small>Use as setas para ordenar. Quadros ocultos continuam disponíveis.</small></div>
            <span className="dashboard-counter">{layout.widgets.length}/{MAX_DASHBOARD_WIDGETS}</span>
          </div>

          {!layout.widgets.length ? (
            <div className="empty compact">Adicione um quadro da biblioteca ao lado.</div>
          ) : layout.widgets.map((widget, index) => {
            const catalogo = catalogoDoDashboard(widget.type)
            return (
              <article className={`dashboard-builder-card ${widget.visivel ? '' : 'oculto'}`} key={widget.id}>
                <div className="dashboard-builder-card-top">
                  <GripVertical size={16} className="dashboard-drag-icon" aria-hidden="true" />
                  <span className="dashboard-builder-index">{index + 1}</span>
                  <div className="dashboard-builder-name"><strong>{catalogo.label}</strong><small>{rotuloFamilia[catalogo.family] ?? catalogo.family}</small></div>
                  <div className="dashboard-builder-order">
                    <button className="icone-btn" type="button" aria-label={`Mover ${catalogo.label} para cima`} disabled={index === 0 || salvando} onClick={() => mover(index, -1)}><ArrowUp size={15} /></button>
                    <button className="icone-btn" type="button" aria-label={`Mover ${catalogo.label} para baixo`} disabled={index === layout.widgets.length - 1 || salvando} onClick={() => mover(index, 1)}><ArrowDown size={15} /></button>
                    <button className="icone-btn" type="button" aria-label={widget.visivel ? `Ocultar ${catalogo.label}` : `Mostrar ${catalogo.label}`} disabled={salvando} onClick={() => onChange(atualizarWidget(layout, widget.id, { visivel: !widget.visivel }))}>
                      {widget.visivel ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button className="icone-btn perigo" type="button" aria-label={`Remover ${catalogo.label}`} disabled={salvando} onClick={() => remover(widget.id)}><Trash2 size={15} /></button>
                  </div>
                </div>

                <div className="dashboard-builder-fields">
                  <label className="campo"><span>Visual</span><select aria-label={`Visual do quadro ${index + 1}`} value={widget.type} disabled={salvando} onChange={(event) => alterarTipo(widget, event.target.value as DashboardWidgetType)}>
                    {!DASHBOARD_CATALOG.some((item) => item.type === widget.type) && <option value={widget.type}>{catalogo.label} (nativo)</option>}
                    {DASHBOARD_CATALOG.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
                  </select></label>
                  <label className="campo"><span>Título</span><input aria-label={`Título do quadro ${index + 1}`} maxLength={80} value={widget.titulo} disabled={salvando} onChange={(event) => onChange(atualizarWidget(layout, widget.id, { titulo: event.target.value }))} /></label>
                  <label className="campo"><span>Dados</span><select aria-label={`Dados do quadro ${index + 1}`} value={widget.metric} disabled={salvando} onChange={(event) => onChange(atualizarWidget(layout, widget.id, { metric: event.target.value as DashboardMetric }))}>
                    {DASHBOARD_METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select></label>
                  <label className="campo"><span>Dimensão</span><select aria-label={`Dimensão do quadro ${index + 1}`} value={widget.dimension} disabled={salvando} onChange={(event) => onChange(atualizarWidget(layout, widget.id, { dimension: event.target.value as DashboardDimension }))}>
                    {DASHBOARD_DIMENSIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select></label>
                  <label className="campo"><span>Largura</span><select aria-label={`Largura do quadro ${index + 1}`} value={widget.largura} disabled={salvando} onChange={(event) => onChange(atualizarWidget(layout, widget.id, { largura: event.target.value as DashboardWidth }))}>
                    <option value="terco">1/3 da linha</option><option value="meio">1/2 da linha</option><option value="full">Linha inteira</option>
                  </select></label>
                  <label className="campo"><span>Meta opcional</span><input aria-label={`Meta do quadro ${index + 1}`} type="number" min="0" step="0.01" value={widget.meta ?? ''} disabled={salvando} onChange={(event) => onChange(atualizarWidget(layout, widget.id, { meta: event.target.value === '' ? null : Number(event.target.value) }))} /></label>
                </div>
              </article>
            )
          })}
        </section>

        <aside className="dashboard-catalog">
          <div className="dashboard-builder-section-head">
            <div><h3>Biblioteca de visuais</h3><small>Catálogo com 62 opções.</small></div>
          </div>
          <div className="dashboard-catalog-filters">
            <label className="campo"><span className="sr-only">Buscar visual</span><div className="campo-input"><Search size={15} /><input placeholder="Buscar visual ou uso" value={busca} onChange={(event) => setBusca(event.target.value)} /></div></label>
            <select aria-label="Filtrar família" value={familia} onChange={(event) => setFamilia(event.target.value)}>
              <option value="todas">Todas as famílias</option>
              {FAMILIAS.map((item) => <option key={item} value={item}>{rotuloFamilia[item] ?? item}</option>)}
            </select>
          </div>
          <div className="dashboard-catalog-items">
            {catalogoFiltrado.map((item) => (
              <button className="dashboard-catalog-item" type="button" key={item.type} disabled={salvando || layout.widgets.length >= MAX_DASHBOARD_WIDGETS} onClick={() => adicionar(item.type)} title={item.description}>
                <span><strong>{item.label}</strong><small>{item.description}</small></span><Plus size={15} />
              </button>
            ))}
            {!catalogoFiltrado.length && <div className="paleta-vazio">Nenhum visual encontrado.</div>}
          </div>
          {layout.widgets.length >= MAX_DASHBOARD_WIDGETS && <small className="dashboard-limit-note">Limite de {MAX_DASHBOARD_WIDGETS} quadros ativos para manter o plano free rápido.</small>}
        </aside>
      </div>
    </div>
  )
}
