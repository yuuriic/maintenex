import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ChevronDown, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Badge, Campo, ConfirmarExclusao, Modal, Skeleton, Vazio } from '../components/ui'
import { data, titulo } from '../lib/format'
import type { Checklist as ChecklistTipo, Equipamento, StatusChecklist, TipoChecklist } from '../lib/types'

const tomStatus: Record<StatusChecklist, string> = {
  pendente: 'ambar', em_andamento: 'azul', concluido: 'verde', cancelado: 'cinza',
}

const itensPadrao = [
  'Verificar contador de páginas',
  'Limpar vidro e ADF',
  'Conferir nível de suprimentos',
  'Testar impressão de página de teste',
  'Registrar ocorrências',
]

export default function Checklist() {
  const { cidadeId, empresaId } = useApp()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | StatusChecklist>('todos')
  const [aberto, setAberto] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [excluir, setExcluir] = useState<ChecklistTipo | null>(null)
  const [form, setForm] = useState({
    equipamento_id: '', titulo: '', tipo: 'preventiva' as TipoChecklist,
    data_prevista: new Date().toISOString().slice(0, 10), observacoes: '',
  })

  const { dados: equipamentos } = useConsulta<Equipamento[]>(async () => {
    let q = supabase.from('equipamentos').select('id, codigo, nome, cidade_id').order('codigo')
    if (cidadeId) q = q.eq('cidade_id', cidadeId)
    const { data: linhas, error } = await q
    if (error) throw error
    return (linhas ?? []) as Equipamento[]
  }, [cidadeId])

  const { dados, carregando, recarregar } = useConsulta<ChecklistTipo[]>(async () => {
    const { data: linhas, error } = await supabase
      .from('checklists')
      .select('*, equipamentos(id, codigo, nome, cidade_id), checklist_itens(*)')
      .order('data_prevista', { ascending: false })
    if (error) throw error
    const todos = (linhas ?? []) as ChecklistTipo[]
    return cidadeId ? todos.filter((c) => c.equipamentos?.cidade_id === cidadeId) : todos
  }, [cidadeId])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (dados ?? []).filter((c) => {
      const casaBusca = !termo || [c.titulo, c.equipamentos?.codigo, c.equipamentos?.nome]
        .some((v) => v?.toLowerCase().includes(termo))
      return casaBusca && (filtro === 'todos' || c.status === filtro)
    })
  }, [dados, busca, filtro])

  const resumo = useMemo(() => {
    const todos = dados ?? []
    return {
      pendentes: todos.filter((c) => c.status === 'pendente').length,
      andamento: todos.filter((c) => c.status === 'em_andamento').length,
      concluidos: todos.filter((c) => c.status === 'concluido').length,
    }
  }, [dados])

  async function criar() {
    if (!form.equipamento_id || !form.titulo) { toast.erro('Informe equipamento e título.'); return }
    const { data: novo, error } = await supabase.from('checklists').insert({
      empresa_id: empresaId,
      equipamento_id: form.equipamento_id,
      titulo: form.titulo,
      tipo: form.tipo,
      data_prevista: form.data_prevista,
      observacoes: form.observacoes || null,
    }).select().single()

    if (error) { toast.erro(error.message); return }

    await supabase.from('checklist_itens').insert(
      itensPadrao.map((descricao, ordem) => ({
        empresa_id: empresaId, checklist_id: novo.id, descricao, ordem: ordem + 1,
      })),
    )
    toast.sucesso('Checklist criado com itens padrão.')
    setCriando(false)
    setForm({ ...form, titulo: '', observacoes: '' })
    void recarregar()
  }

  async function alternarItem(itemId: string, concluido: boolean) {
    const { error } = await supabase.from('checklist_itens').update({ concluido }).eq('id', itemId)
    if (error) { toast.erro(error.message); return }
    void recarregar()
  }

  async function mudarStatus(c: ChecklistTipo, status: StatusChecklist) {
    const { error } = await supabase.from('checklists').update({
      status,
      data_conclusao: status === 'concluido' ? new Date().toISOString() : null,
    }).eq('id', c.id)
    if (error) { toast.erro(error.message); return }
    toast.sucesso(`Checklist marcado como ${titulo(status).toLowerCase()}.`)
    void recarregar()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    const { error } = await supabase.from('checklists').delete().eq('id', excluir.id)
    setExcluir(null)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Checklist excluído.')
    void recarregar()
  }

  return (
    <section>
      <div className="title-row">
        <div>
          <h1>Checklist</h1>
          <p>{resumo.pendentes} pendente(s) · {resumo.andamento} em andamento · {resumo.concluidos} concluído(s)</p>
        </div>
        <button className="btn primario" onClick={() => setCriando(true)}><Plus size={16} />Novo checklist</button>
      </div>

      <div className="filtros">
        <div className="campo-input busca">
          <Search size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título ou equipamento…" />
        </div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {carregando ? <Skeleton /> : !lista.length ? <Vazio texto="Nenhum checklist encontrado" /> : (
        <div className="lista-cards">
          {lista.map((c) => {
            const itens = [...(c.checklist_itens ?? [])].sort((a, b) => a.ordem - b.ordem)
            const feitos = itens.filter((i) => i.concluido).length
            const progresso = itens.length ? Math.round((feitos / itens.length) * 100) : 0
            const expandido = aberto === c.id

            return (
              <article key={c.id} className={`checklist-card ${expandido ? 'aberto' : ''}`}>
                <button className="checklist-head" onClick={() => setAberto(expandido ? null : c.id)}>
                  <div className="checklist-titulo">
                    <b>{c.titulo}</b>
                    <small>{c.equipamentos?.codigo} · {c.equipamentos?.nome}</small>
                  </div>
                  <div className="checklist-meta">
                    <Badge tom={c.tipo === 'preventiva' ? 'azul' : 'roxo'}>{titulo(c.tipo)}</Badge>
                    <Badge tom={tomStatus[c.status]}>{titulo(c.status)}</Badge>
                    <span className="prazo"><CalendarClock size={14} />{data(c.data_prevista)}</span>
                    <ChevronDown size={16} className="chevron" />
                  </div>
                </button>

                <div className="progresso"><div style={{ width: `${progresso}%` }} /><span>{feitos}/{itens.length}</span></div>

                {expandido && (
                  <div className="checklist-corpo">
                    <ul className="itens">
                      {itens.map((item) => (
                        <li key={item.id}>
                          <label>
                            <input type="checkbox" checked={item.concluido}
                              onChange={(e) => void alternarItem(item.id, e.target.checked)} />
                            <span className={item.concluido ? 'feito' : ''}>{item.descricao}</span>
                          </label>
                        </li>
                      ))}
                      {!itens.length && <li className="sem-itens">Sem itens cadastrados.</li>}
                    </ul>
                    {c.observacoes && <p className="observacoes">{c.observacoes}</p>}
                    <div className="checklist-acoes">
                      {c.status !== 'em_andamento' && c.status !== 'concluido' && (
                        <button className="btn" onClick={() => void mudarStatus(c, 'em_andamento')}>Iniciar</button>
                      )}
                      {c.status !== 'concluido' && (
                        <button className="btn primario" onClick={() => void mudarStatus(c, 'concluido')}>
                          <CheckCircle2 size={15} />Concluir
                        </button>
                      )}
                      {c.status === 'concluido' && (
                        <button className="btn" onClick={() => void mudarStatus(c, 'pendente')}>Reabrir</button>
                      )}
                      <button className="btn perigo" onClick={() => setExcluir(c)}><Trash2 size={15} />Excluir</button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <Modal aberto={criando} titulo="Novo checklist" onFechar={() => setCriando(false)}>
        <div className="form-grid">
          <Campo rotulo="Equipamento">
            <select value={form.equipamento_id} onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })}>
              <option value="">Selecione…</option>
              {(equipamentos ?? []).map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoChecklist })}>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </select>
          </Campo>
          <Campo rotulo="Título"><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Limpeza geral" /></Campo>
          <Campo rotulo="Data prevista"><input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} /></Campo>
          <Campo rotulo="Observações"><textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Campo>
        </div>
        <p className="dica">Os 5 itens padrão de inspeção são criados automaticamente.</p>
        <div className="modal-acoes">
          <button className="btn" onClick={() => setCriando(false)}>Cancelar</button>
          <button className="btn primario" onClick={() => void criar()}>Criar checklist</button>
        </div>
      </Modal>

      <ConfirmarExclusao aberto={!!excluir} onCancelar={() => setExcluir(null)} onConfirmar={() => void confirmarExclusao()}
        texto={`Excluir o checklist "${excluir?.titulo}" e todos os seus itens?`} />
    </section>
  )
}
