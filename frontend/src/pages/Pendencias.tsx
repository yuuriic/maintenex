import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Badge, Campo, ConfirmarExclusao, Modal, Skeleton, StatCard, Vazio } from '../components/ui'
import { diasDesde, dataHora, nf, titulo } from '../lib/format'
import type { Equipamento, Pendencia, PrioridadePendencia, StatusPendencia } from '../lib/types'

const tomPrioridade: Record<PrioridadePendencia, string> = {
  baixa: 'cinza', media: 'azul', alta: 'ambar', critica: 'vermelho',
}

const colunas: { chave: StatusPendencia; rotulo: string }[] = [
  { chave: 'aberta', rotulo: 'Abertas' },
  { chave: 'em_andamento', rotulo: 'Em andamento' },
  { chave: 'resolvida', rotulo: 'Resolvidas' },
]

export default function Pendencias() {
  const { cidadeId, empresaId } = useApp()
  const { profile } = useAuth()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState<'todas' | PrioridadePendencia>('todas')
  const [criando, setCriando] = useState(false)
  const [excluir, setExcluir] = useState<Pendencia | null>(null)
  const [form, setForm] = useState({
    titulo: '', descricao: '', equipamento_id: '', prioridade: 'media' as PrioridadePendencia,
  })

  const { dados: equipamentos } = useConsulta<Equipamento[]>(async () => {
    let q = supabase.from('equipamentos').select('id, codigo, nome').order('codigo')
    if (cidadeId) q = q.eq('cidade_id', cidadeId)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as Equipamento[]
  }, [cidadeId])

  const { dados, carregando, recarregar } = useConsulta<Pendencia[]>(async () => {
    let q = supabase.from('pendencias')
      .select('*, equipamentos(id, codigo, nome)')
      .order('aberta_em', { ascending: false })
    if (cidadeId) q = q.eq('cidade_id', cidadeId)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as Pendencia[]
  }, [cidadeId])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (dados ?? []).filter((p) => {
      const casaBusca = !termo || [p.titulo, p.descricao, p.equipamentos?.codigo]
        .some((v) => v?.toLowerCase().includes(termo))
      return casaBusca && (filtroPrioridade === 'todas' || p.prioridade === filtroPrioridade)
    })
  }, [dados, busca, filtroPrioridade])

  const kpis = useMemo(() => {
    const todas = dados ?? []
    const abertas = todas.filter((p) => p.status === 'aberta' || p.status === 'em_andamento')
    const resolvidas = todas.filter((p) => p.status === 'resolvida' && p.fechada_em)
    const sla = resolvidas.length
      ? resolvidas.reduce((soma, p) =>
          soma + (new Date(p.fechada_em!).getTime() - new Date(p.aberta_em).getTime()) / 86_400_000, 0) / resolvidas.length
      : 0
    return {
      abertas: abertas.length,
      criticas: abertas.filter((p) => p.prioridade === 'critica').length,
      resolvidas: resolvidas.length,
      sla: sla.toFixed(1),
    }
  }, [dados])

  async function criar() {
    if (!cidadeId) { toast.erro('Selecione uma cidade no topo.'); return }
    if (!form.titulo) { toast.erro('Informe um título.'); return }
    const { error } = await supabase.from('pendencias').insert({
      empresa_id: empresaId,
      cidade_id: cidadeId,
      equipamento_id: form.equipamento_id || null,
      titulo: form.titulo,
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      responsavel_id: profile?.id ?? null,
    })
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Pendência aberta.')
    setCriando(false)
    setForm({ titulo: '', descricao: '', equipamento_id: '', prioridade: 'media' })
    void recarregar()
  }

  async function mover(p: Pendencia, status: StatusPendencia) {
    const { error } = await supabase.from('pendencias').update({
      status,
      fechada_em: status === 'resolvida' ? new Date().toISOString() : null,
    }).eq('id', p.id)
    if (error) { toast.erro(error.message); return }
    void recarregar()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    const { error } = await supabase.from('pendencias').delete().eq('id', excluir.id)
    setExcluir(null)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Pendência excluída.')
    void recarregar()
  }

  return (
    <section>
      <div className="title-row">
        <div><h1>Pendências</h1><p>Quadro por status — clique nos botões do cartão para avançar</p></div>
        <button className="btn primario" onClick={() => setCriando(true)}><Plus size={16} />Nova pendência</button>
      </div>

      <div className="cards">
        <StatCard rotulo="Em aberto" valor={nf.format(kpis.abertas)} detalhe="aguardando resolução" tom="ambar" />
        <StatCard rotulo="Críticas" valor={nf.format(kpis.criticas)} detalhe="prioridade máxima" tom="vermelho" />
        <StatCard rotulo="Resolvidas" valor={nf.format(kpis.resolvidas)} detalhe="histórico total" tom="verde" />
        <StatCard rotulo="SLA médio" valor={`${kpis.sla} d`} detalhe="abertura → resolução" tom="azul" icone={<Clock size={18} />} />
      </div>

      <div className="filtros">
        <div className="campo-input busca">
          <Search size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pendência…" />
        </div>
        <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value as typeof filtroPrioridade)}>
          <option value="todas">Todas as prioridades</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>

      {carregando ? <Skeleton /> : (
        <div className="kanban">
          {colunas.map((coluna) => {
            const itens = lista.filter((p) => p.status === coluna.chave)
            return (
              <div key={coluna.chave} className="kanban-coluna">
                <header><h2>{coluna.rotulo}</h2><span>{itens.length}</span></header>
                {!itens.length && <Vazio texto="Nada aqui" compacto />}
                {itens.map((p) => (
                  <article key={p.id} className="kanban-card">
                    <div className="kanban-topo">
                      <Badge tom={tomPrioridade[p.prioridade]}>{titulo(p.prioridade)}</Badge>
                      <button className="icone-btn perigo" onClick={() => setExcluir(p)} aria-label="Excluir"><Trash2 size={14} /></button>
                    </div>
                    <b>{p.titulo}</b>
                    {p.descricao && <p>{p.descricao}</p>}
                    <small>{p.equipamentos?.codigo ?? 'Sem equipamento'} · {diasDesde(p.aberta_em)}d em aberto</small>
                    <div className="kanban-acoes">
                      {coluna.chave !== 'aberta' && (
                        <button className="btn mini" onClick={() => void mover(p, coluna.chave === 'resolvida' ? 'em_andamento' : 'aberta')}>
                          ← Voltar
                        </button>
                      )}
                      {coluna.chave === 'aberta' && (
                        <button className="btn mini" onClick={() => void mover(p, 'em_andamento')}>Iniciar →</button>
                      )}
                      {coluna.chave === 'em_andamento' && (
                        <button className="btn mini primario" onClick={() => void mover(p, 'resolvida')}>
                          <CheckCircle2 size={13} />Resolver
                        </button>
                      )}
                      {coluna.chave === 'resolvida' && p.fechada_em && (
                        <span className="fechada">{dataHora(p.fechada_em)}</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <Modal aberto={criando} titulo="Nova pendência" onFechar={() => setCriando(false)}>
        <div className="form-grid">
          <Campo rotulo="Título"><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ruído anormal no fusor" /></Campo>
          <Campo rotulo="Prioridade">
            <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value as PrioridadePendencia })}>
              <option value="baixa">Baixa</option><option value="media">Média</option>
              <option value="alta">Alta</option><option value="critica">Crítica</option>
            </select>
          </Campo>
          <Campo rotulo="Equipamento">
            <select value={form.equipamento_id} onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })}>
              <option value="">Sem equipamento</option>
              {(equipamentos ?? []).map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Descrição"><textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Campo>
        </div>
        <div className="modal-acoes">
          <button className="btn" onClick={() => setCriando(false)}>Cancelar</button>
          <button className="btn primario" onClick={() => void criar()}>Abrir pendência</button>
        </div>
      </Modal>

      <ConfirmarExclusao aberto={!!excluir} onCancelar={() => setExcluir(null)} onConfirmar={() => void confirmarExclusao()}
        texto={`Excluir a pendência "${excluir?.titulo}"?`} />
    </section>
  )
}
