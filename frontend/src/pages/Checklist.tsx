import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ChevronDown, Plus, Save, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Badge, Campo, ConfirmarExclusao, Modal, Skeleton, Vazio } from '../components/ui'
import { data, titulo } from '../lib/format'
import type { Checklist as ChecklistTipo, Equipamento, StatusChecklist, TipoChecklist } from '../lib/types'

const tomStatus: Record<StatusChecklist, string> = {
  pendente: 'ambar', em_andamento: 'azul', concluido: 'verde', cancelado: 'cinza',
}

const itensPorTipo: Record<TipoChecklist, readonly string[]> = {
  preventiva: [
    'Verificar contador de páginas',
    'Limpar vidro e ADF',
    'Conferir nível de suprimentos',
    'Testar impressão de página de teste',
    'Registrar ocorrências',
  ],
  corretiva: [
    'Identificar e registrar a falha',
    'Diagnosticar a causa do problema',
    'Executar o reparo ou a substituição necessária',
    'Testar o funcionamento após o reparo',
    'Registrar peças utilizadas e recomendações',
  ],
}

interface DetalhesChecklist {
  tecnico_nome: string
  observacoes: string
}

function formularioInicial(tecnicoNome = '') {
  return {
    equipamento_id: '',
    titulo: '',
    tipo: 'preventiva' as TipoChecklist,
    data_prevista: new Date().toISOString().slice(0, 10),
    tecnico_nome: tecnicoNome,
    observacoes: '',
    itens_selecionados: [...itensPorTipo.preventiva],
  }
}

export default function Checklist() {
  const { cidadeId, empresaId } = useApp()
  const { profile, user } = useAuth()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | StatusChecklist>('todos')
  const [aberto, setAberto] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [excluir, setExcluir] = useState<ChecklistTipo | null>(null)
  const [detalhes, setDetalhes] = useState<Record<string, DetalhesChecklist>>({})
  const [form, setForm] = useState(formularioInicial)

  const { dados: equipamentos } = useConsulta<Equipamento[]>(async () => {
    let q = supabase.from('equipamentos').select('id, codigo, nome, cidade_id').order('codigo')
    if (cidadeId) q = q.eq('cidade_id', cidadeId)
    const { data: linhas, error } = await q
    if (error) throw error
    return (linhas ?? []) as Equipamento[]
  }, [cidadeId])

  const { dados, setDados, carregando, recarregar } = useConsulta<ChecklistTipo[]>(async () => {
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

  function abrirCriacao() {
    setForm(formularioInicial(profile?.nome ?? ''))
    setCriando(true)
  }

  function mudarTipo(tipo: TipoChecklist) {
    setForm((atual) => ({ ...atual, tipo, itens_selecionados: [...itensPorTipo[tipo]] }))
  }

  function alternarItemCriacao(descricao: string) {
    setForm((atual) => ({
      ...atual,
      itens_selecionados: atual.itens_selecionados.includes(descricao)
        ? atual.itens_selecionados.filter((item) => item !== descricao)
        : [...atual.itens_selecionados, descricao],
    }))
  }

  async function criar() {
    if (!form.equipamento_id || !form.titulo.trim()) {
      toast.erro('Informe equipamento e título.')
      return
    }
    if (!form.tecnico_nome.trim()) {
      toast.erro('Informe o nome do técnico responsável.')
      return
    }
    if (!form.itens_selecionados.length) {
      toast.erro('Selecione ao menos um item para o checklist.')
      return
    }

    const { data: novo, error } = await supabase.from('checklists').insert({
      empresa_id: empresaId,
      equipamento_id: form.equipamento_id,
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      data_prevista: form.data_prevista,
      responsavel_id: user?.id ?? null,
      tecnico_nome: form.tecnico_nome.trim(),
      observacoes: form.observacoes.trim() || null,
    }).select().single()
    if (error) { toast.erro('Não foi possível criar o checklist. Tente novamente.'); return }

    const itensOrdenados = itensPorTipo[form.tipo].filter((item) => form.itens_selecionados.includes(item))
    const { error: erroItens } = await supabase.from('checklist_itens').insert(
      itensOrdenados.map((descricao, ordem) => ({
        empresa_id: empresaId, checklist_id: novo.id, descricao, ordem: ordem + 1,
      })),
    )
    if (erroItens) {
      toast.erro('Checklist criado, mas não foi possível salvar os itens. Tente novamente.')
      void recarregar()
      return
    }

    toast.sucesso('Checklist criado com os itens selecionados.')
    setCriando(false)
    setForm(formularioInicial(profile?.nome ?? ''))
    void recarregar()
  }

  async function alternarItem(checklistId: string, itemId: string, concluido: boolean) {
    setDados((atuais) => atuais?.map((checklist) => checklist.id !== checklistId ? checklist : {
      ...checklist,
      checklist_itens: checklist.checklist_itens?.map((item) => item.id === itemId ? { ...item, concluido } : item),
    }) ?? null)

    const { error } = await supabase.from('checklist_itens')
      .update({ concluido })
      .eq('id', itemId)
      .eq('empresa_id', empresaId)

    if (error) {
      setDados((atuais) => atuais?.map((checklist) => checklist.id !== checklistId ? checklist : {
        ...checklist,
        checklist_itens: checklist.checklist_itens?.map((item) => item.id === itemId ? { ...item, concluido: !concluido } : item),
      }) ?? null)
      toast.erro('Não foi possível atualizar o item. Tente novamente.')
    }
  }

  function detalhesAtuais(c: ChecklistTipo): DetalhesChecklist {
    return detalhes[c.id] ?? { tecnico_nome: c.tecnico_nome ?? '', observacoes: c.observacoes ?? '' }
  }

  function alterarDetalhe(c: ChecklistTipo, campo: keyof DetalhesChecklist, valor: string) {
    setDetalhes((atuais) => ({
      ...atuais,
      [c.id]: { ...detalhesAtuais(c), ...atuais[c.id], [campo]: valor },
    }))
  }

  async function salvarDetalhes(c: ChecklistTipo, mostrarSucesso = true) {
    const atuais = detalhesAtuais(c)
    const tecnicoNome = atuais.tecnico_nome.trim()
    const descricao = atuais.observacoes.trim()
    if (!tecnicoNome) {
      toast.erro('Informe o nome do técnico responsável.')
      return false
    }

    const { error } = await supabase.from('checklists').update({
      tecnico_nome: tecnicoNome,
      observacoes: descricao || null,
    }).eq('id', c.id).eq('empresa_id', empresaId)
    if (error) {
      toast.erro('Não foi possível salvar os detalhes do checklist.')
      return false
    }

    setDados((atuaisDados) => atuaisDados?.map((checklist) => checklist.id === c.id
      ? { ...checklist, tecnico_nome: tecnicoNome, observacoes: descricao || null }
      : checklist) ?? null)
    setDetalhes((atuaisDetalhes) => {
      const proximos = { ...atuaisDetalhes }
      delete proximos[c.id]
      return proximos
    })
    if (mostrarSucesso) toast.sucesso('Identificação e descrição salvas.')
    return true
  }

  async function mudarStatus(c: ChecklistTipo, status: StatusChecklist) {
    if (status === 'concluido') {
      if (!await salvarDetalhes(c, false)) return
    }

    const dataConclusao = status === 'concluido' ? new Date().toISOString() : null
    const { error } = await supabase.from('checklists').update({
      status,
      data_conclusao: dataConclusao,
    }).eq('id', c.id).eq('empresa_id', empresaId)
    if (error) { toast.erro('Não foi possível alterar o status do checklist.'); return }

    setDados((atuais) => atuais?.map((checklist) => checklist.id === c.id
      ? { ...checklist, status, data_conclusao: dataConclusao }
      : checklist) ?? null)
    toast.sucesso(`Checklist marcado como ${titulo(status).toLowerCase()}.`)
  }

  async function confirmarExclusao() {
    if (!excluir) return
    const { error } = await supabase.from('checklists').delete()
      .eq('id', excluir.id)
      .eq('empresa_id', empresaId)
    if (error) { setExcluir(null); toast.erro('Não foi possível excluir o checklist.'); return }
    setDados((atuais) => atuais?.filter((checklist) => checklist.id !== excluir.id) ?? null)
    setExcluir(null)
    toast.sucesso('Checklist excluído.')
  }

  return (
    <section>
      <div className="title-row">
        <div>
          <h1>Checklist</h1>
          <p>{resumo.pendentes} pendente(s) · {resumo.andamento} em andamento · {resumo.concluidos} concluído(s)</p>
        </div>
        <button className="btn primario" onClick={abrirCriacao}><Plus size={16} />Novo checklist</button>
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
            const detalhesChecklist = detalhesAtuais(c)

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
                              onChange={(e) => void alternarItem(c.id, item.id, e.target.checked)} />
                            <span className={item.concluido ? 'feito' : ''}>{item.descricao}</span>
                          </label>
                        </li>
                      ))}
                      {!itens.length && <li className="sem-itens">Sem itens cadastrados.</li>}
                    </ul>

                    <div className="checklist-detalhes">
                      <Campo rotulo="Técnico responsável">
                        <input value={detalhesChecklist.tecnico_nome} maxLength={120}
                          onChange={(e) => alterarDetalhe(c, 'tecnico_nome', e.target.value)} placeholder="Nome do técnico" />
                      </Campo>
                      <Campo rotulo="Descrição do serviço realizado">
                        <textarea rows={3} value={detalhesChecklist.observacoes} maxLength={2000}
                          onChange={(e) => alterarDetalhe(c, 'observacoes', e.target.value)}
                          placeholder="Descreva com detalhes o diagnóstico, o serviço executado e as peças utilizadas" />
                      </Campo>
                    </div>

                    <div className="checklist-acoes">
                      <button className="btn" onClick={() => void salvarDetalhes(c)}><Save size={15} />Salvar detalhes</button>
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

      <Modal aberto={criando} titulo="Novo checklist" onFechar={() => setCriando(false)} largura={680}>
        <div className="form-grid">
          <Campo rotulo="Equipamento">
            <select value={form.equipamento_id} onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })}>
              <option value="">Selecione…</option>
              {(equipamentos ?? []).map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo">
            <select value={form.tipo} onChange={(e) => mudarTipo(e.target.value as TipoChecklist)}>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </select>
          </Campo>
          <Campo rotulo="Título"><input value={form.titulo} maxLength={160} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Limpeza geral" /></Campo>
          <Campo rotulo="Data prevista"><input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} /></Campo>
          <Campo rotulo="Técnico responsável"><input value={form.tecnico_nome} maxLength={120} onChange={(e) => setForm({ ...form, tecnico_nome: e.target.value })} placeholder="Nome do técnico" /></Campo>
          <Campo rotulo="Descrição do serviço">
            <textarea rows={3} value={form.observacoes} maxLength={2000}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Pode ser preenchida agora ou durante a execução" />
          </Campo>
        </div>

        <fieldset className="itens-criacao">
          <legend>Itens do checklist {form.tipo}</legend>
          {itensPorTipo[form.tipo].map((item) => (
            <label key={item}>
              <input type="checkbox" checked={form.itens_selecionados.includes(item)} onChange={() => alternarItemCriacao(item)} />
              <span>{item}</span>
            </label>
          ))}
        </fieldset>

        <p className="dica">Selecione os itens que farão parte deste checklist. A descrição pode ser complementada durante a execução.</p>
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
