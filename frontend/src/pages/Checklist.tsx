import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ClipboardCheck, Pencil, Plus, Save, Search, Trash2, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Badge, Campo, ConfirmarExclusao, Modal, Skeleton, Vazio } from '../components/ui'
import { data, titulo } from '../lib/format'
import type { Checklist as ChecklistTipo, ChecklistItem, Equipamento, StatusChecklist, TipoChecklist } from '../lib/types'

const tomStatus: Record<StatusChecklist, string> = {
  pendente: 'ambar', em_andamento: 'azul', concluido: 'verde', cancelado: 'cinza',
}

interface SecaoModelo {
  titulo: string
  itens: readonly string[]
}

const modelosPorTipo: Record<TipoChecklist, readonly SecaoModelo[]> = {
  preventiva: [
    {
      titulo: 'Inspeção física',
      itens: [
        'Verificar integridade da estrutura ou carcaça',
        'Verificar tela, display, botões e superfícies',
        'Verificar cabos, conectores e portas',
        'Verificar sinais de impacto, umidade ou oxidação',
      ],
    },
    {
      titulo: 'Limpeza e conservação',
      itens: [
        'Realizar limpeza externa do equipamento',
        'Limpar entradas, saídas e conectores',
        'Limpar ventilação e dissipação quando aplicável',
        'Higienizar acessórios e periféricos',
      ],
    },
    {
      titulo: 'Energia e alimentação',
      itens: [
        'Verificar fonte ou carregador',
        'Verificar cabo e conector de alimentação',
        'Verificar bateria e autonomia quando aplicável',
        'Verificar aquecimento ou consumo anormal',
      ],
    },
    {
      titulo: 'Hardware e componentes',
      itens: [
        'Verificar armazenamento e integridade de dados',
        'Verificar memória e desempenho geral',
        'Verificar temperatura, ventilação e ruídos',
        'Verificar componentes internos acessíveis',
      ],
    },
    {
      titulo: 'Software e conectividade',
      itens: [
        'Verificar sistema operacional ou firmware',
        'Verificar atualizações e drivers',
        'Testar rede, Wi-Fi, Bluetooth ou comunicação',
        'Verificar configurações e segurança básica',
      ],
    },
    {
      titulo: 'Testes funcionais',
      itens: [
        'Testar inicialização e desligamento',
        'Testar tela, áudio, câmera ou impressão quando aplicável',
        'Testar portas, sensores e periféricos',
        'Executar teste final de funcionamento',
      ],
    },
  ],
  corretiva: [
    {
      titulo: 'Registro da falha',
      itens: [
        'Confirmar o problema relatado pelo solicitante',
        'Reproduzir a falha quando possível',
        'Registrar mensagens de erro, alertas ou sintomas',
        'Avaliar o impacto e a condição de uso do equipamento',
      ],
    },
    {
      titulo: 'Diagnóstico inicial',
      itens: [
        'Inspecionar danos físicos, umidade ou oxidação',
        'Verificar alimentação, fonte, carregador ou bateria',
        'Testar cabos, conectores, portas e periféricos',
        'Identificar a causa provável ou raiz do problema',
      ],
    },
    {
      titulo: 'Hardware e componentes',
      itens: [
        'Testar armazenamento e integridade de dados',
        'Testar memória, processamento e desempenho',
        'Verificar temperatura, ventilação e ruídos',
        'Testar componentes internos ou módulos afetados',
      ],
    },
    {
      titulo: 'Software e conectividade',
      itens: [
        'Verificar sistema operacional ou firmware',
        'Verificar drivers, atualizações e configurações',
        'Testar rede, Wi-Fi, Bluetooth ou comunicação',
        'Verificar falhas de software ou segurança',
      ],
    },
    {
      titulo: 'Reparo executado',
      itens: [
        'Reparar ou substituir o componente necessário',
        'Restaurar ou reconfigurar o sistema',
        'Atualizar software, firmware ou drivers necessários',
        'Realizar limpeza técnica relacionada à falha',
      ],
    },
    {
      titulo: 'Validação do reparo',
      itens: [
        'Confirmar que a falha original foi eliminada',
        'Executar testes funcionais e de conectividade',
        'Realizar teste de estabilidade quando aplicável',
        'Registrar recomendações e condições de entrega',
      ],
    },
  ],
}

interface DetalhesChecklist {
  titulo: string
  data_prevista: string
  status: StatusChecklist
  tecnico_nome: string
  observacoes: string
  itens_marcados: string[]
}

function formularioInicial(tecnicoNome = '') {
  return {
    equipamento_id: '',
    titulo: '',
    tipo: 'preventiva' as TipoChecklist,
    data_prevista: new Date().toISOString().slice(0, 10),
    tecnico_nome: tecnicoNome,
    observacoes: '',
    itens_marcados: [] as string[],
  }
}

function agruparItens(itens: ChecklistItem[]) {
  return itens.reduce<Map<string, ChecklistItem[]>>((grupos, item) => {
    const secao = item.secao?.trim() || 'Itens do checklist'
    grupos.set(secao, [...(grupos.get(secao) ?? []), item])
    return grupos
  }, new Map())
}

export default function Checklist() {
  const { cidadeId, empresaId } = useApp()
  const { profile, user } = useAuth()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | StatusChecklist>('todos')
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<ChecklistTipo | null>(null)
  const [edicao, setEdicao] = useState<DetalhesChecklist | null>(null)
  const [excluir, setExcluir] = useState<ChecklistTipo | null>(null)
  const [form, setForm] = useState(formularioInicial)

  const { dados: equipamentos } = useConsulta<Equipamento[]>(async () => {
    let q = supabase.from('equipamentos')
      .select('id, codigo, nome, marca, modelo, numero_serie, localizacao, cidade_id')
      .order('codigo')
    if (cidadeId) q = q.eq('cidade_id', cidadeId)
    const { data: linhas, error } = await q
    if (error) throw error
    return (linhas ?? []) as Equipamento[]
  }, [cidadeId])

  const { dados, setDados, carregando, recarregar } = useConsulta<ChecklistTipo[]>(async () => {
    const { data: linhas, error } = await supabase
      .from('checklists')
      .select('*, equipamentos(id, codigo, nome, marca, modelo, numero_serie, localizacao, cidade_id), checklist_itens(*)')
      .order('data_prevista', { ascending: false })
    if (error) throw error
    const todos = (linhas ?? []) as ChecklistTipo[]
    return cidadeId ? todos.filter((c) => c.equipamentos?.cidade_id === cidadeId) : todos
  }, [cidadeId])

  const equipamentoSelecionado = useMemo(
    () => (equipamentos ?? []).find((equipamento) => equipamento.id === form.equipamento_id) ?? null,
    [equipamentos, form.equipamento_id],
  )

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
    setForm((atual) => ({ ...atual, tipo, itens_marcados: [] }))
  }

  function alternarItemCriacao(descricao: string) {
    setForm((atual) => ({
      ...atual,
      itens_marcados: atual.itens_marcados.includes(descricao)
        ? atual.itens_marcados.filter((item) => item !== descricao)
        : [...atual.itens_marcados, descricao],
    }))
  }

  async function criar() {
    if (!form.equipamento_id || !form.titulo.trim()) {
      toast.erro('Informe o equipamento e o título do checklist.')
      return
    }
    if (!form.tecnico_nome.trim()) {
      toast.erro('Informe o nome do técnico responsável.')
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

    let ordem = 0
    const itens = modelosPorTipo[form.tipo].flatMap((secao) => secao.itens.map((descricao) => ({
      empresa_id: empresaId,
      checklist_id: novo.id,
      secao: secao.titulo,
      descricao,
      concluido: form.itens_marcados.includes(descricao),
      ordem: ++ordem,
    })))
    const { error: erroItens } = await supabase.from('checklist_itens').insert(itens)
    if (erroItens) {
      toast.erro('Checklist criado, mas não foi possível salvar os itens. Tente novamente.')
      void recarregar()
      return
    }

    toast.sucesso('Checklist criado com o modelo selecionado.')
    setCriando(false)
    setForm(formularioInicial(profile?.nome ?? ''))
    void recarregar()
  }

  function abrirEdicao(c: ChecklistTipo) {
    setEditando(c)
    setEdicao({
      titulo: c.titulo,
      data_prevista: c.data_prevista,
      status: c.status,
      tecnico_nome: c.tecnico_nome ?? profile?.nome ?? '',
      observacoes: c.observacoes ?? '',
      itens_marcados: (c.checklist_itens ?? []).filter((item) => item.concluido).map((item) => item.id),
    })
  }

  function alternarItemEdicao(itemId: string) {
    setEdicao((atual) => atual ? {
      ...atual,
      itens_marcados: atual.itens_marcados.includes(itemId)
        ? atual.itens_marcados.filter((id) => id !== itemId)
        : [...atual.itens_marcados, itemId],
    } : atual)
  }

  async function salvarEdicao() {
    if (!editando || !edicao) return
    if (!edicao.titulo.trim() || !edicao.tecnico_nome.trim()) {
      toast.erro('Informe o título e o nome do técnico responsável.')
      return
    }

    const marcados = new Set(edicao.itens_marcados)
    const itensAlterados = (editando.checklist_itens ?? []).filter((item) => item.concluido !== marcados.has(item.id))
    const resultados = await Promise.all(itensAlterados.map((item) => supabase
      .from('checklist_itens')
      .update({ concluido: marcados.has(item.id) })
      .eq('id', item.id)
      .eq('checklist_id', editando.id)
      .eq('empresa_id', empresaId)))

    if (resultados.some((resultado) => resultado.error)) {
      toast.erro('Não foi possível salvar todos os itens do checklist.')
      void recarregar()
      return
    }

    const dataConclusao = edicao.status === 'concluido'
      ? editando.data_conclusao ?? new Date().toISOString()
      : null
    const { error } = await supabase.from('checklists').update({
      titulo: edicao.titulo.trim(),
      data_prevista: edicao.data_prevista,
      status: edicao.status,
      data_conclusao: dataConclusao,
      tecnico_nome: edicao.tecnico_nome.trim(),
      observacoes: edicao.observacoes.trim() || null,
    }).eq('id', editando.id).eq('empresa_id', empresaId)

    if (error) {
      toast.erro('Não foi possível salvar as alterações do checklist.')
      void recarregar()
      return
    }

    setDados((atuais) => atuais?.map((checklist) => checklist.id === editando.id ? {
      ...checklist,
      titulo: edicao.titulo.trim(),
      data_prevista: edicao.data_prevista,
      status: edicao.status,
      data_conclusao: dataConclusao,
      tecnico_nome: edicao.tecnico_nome.trim(),
      observacoes: edicao.observacoes.trim() || null,
      checklist_itens: checklist.checklist_itens?.map((item) => ({ ...item, concluido: marcados.has(item.id) })),
    } : checklist) ?? null)
    setEditando(null)
    setEdicao(null)
    toast.sucesso('Checklist atualizado.')
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

  const itensEdicao = [...(editando?.checklist_itens ?? [])].sort((a, b) => a.ordem - b.ordem)
  const gruposEdicao = agruparItens(itensEdicao)

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
        <div className="checklist-cards-grid">
          {lista.map((c) => {
            const itens = [...(c.checklist_itens ?? [])].sort((a, b) => a.ordem - b.ordem)
            const feitos = itens.filter((i) => i.concluido).length
            const progresso = itens.length ? Math.round((feitos / itens.length) * 100) : 0
            const identificacao = [c.equipamentos?.codigo, c.equipamentos?.marca, c.equipamentos?.modelo]
              .filter(Boolean).join(' · ')

            return (
              <article key={c.id} className="checklist-resumo-card">
                <header>
                  <div className={`checklist-card-icone ${c.tipo}`}><ClipboardCheck size={17} /></div>
                  <div className="checklist-card-titulo">
                    <h3>{c.equipamentos?.nome ?? 'Equipamento'}</h3>
                    <p>{identificacao || 'Sem identificação cadastrada'}</p>
                    {c.equipamentos?.numero_serie && <small>Série: {c.equipamentos.numero_serie}</small>}
                  </div>
                  <div className="checklist-card-badges">
                    <Badge tom={c.tipo === 'preventiva' ? 'azul' : 'roxo'}>{titulo(c.tipo)}</Badge>
                    <Badge tom={tomStatus[c.status]}>{titulo(c.status)}</Badge>
                  </div>
                </header>

                <div className="checklist-card-corpo">
                  <div className="checklist-card-info">
                    <span><CalendarClock size={14} />{data(c.data_prevista)}</span>
                    <span><UserRound size={14} />{c.tecnico_nome || 'Técnico não informado'}</span>
                  </div>
                  <div className="checklist-card-servico">
                    <b>{c.titulo}</b>
                    <p>{c.observacoes || 'Nenhuma descrição do serviço informada.'}</p>
                  </div>
                  <div className="checklist-resumo-progresso">
                    <div><span style={{ width: `${progresso}%` }} /></div>
                    <small><CheckCircle2 size={13} />{feitos} de {itens.length} itens realizados</small>
                  </div>
                </div>

                <footer>
                  <button className="btn" onClick={() => abrirEdicao(c)}><Pencil size={15} />Editar checklist</button>
                </footer>
              </article>
            )
          })}
        </div>
      )}

      <Modal aberto={criando} titulo="Novo checklist" onFechar={() => setCriando(false)} largura={940}>
        <div className="checklist-formulario">
          <section className="checklist-form-bloco equipamento-bloco">
            <header><ClipboardCheck size={16} /><h4>Selecionar equipamento</h4><span>obrigatório</span></header>
            <Campo rotulo="Equipamento">
              <select value={form.equipamento_id} onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })}>
                <option value="">Selecione um equipamento…</option>
                {(equipamentos ?? []).map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.nome}</option>)}
              </select>
            </Campo>
            {equipamentoSelecionado && (
              <div className="equipamento-resumo">
                <div><span>Código</span><b>{equipamentoSelecionado.codigo}</b></div>
                <div><span>Equipamento</span><b>{equipamentoSelecionado.nome}</b></div>
                <div><span>Marca / modelo</span><b>{[equipamentoSelecionado.marca, equipamentoSelecionado.modelo].filter(Boolean).join(' · ') || '—'}</b></div>
                <div><span>Série / local</span><b>{[equipamentoSelecionado.numero_serie, equipamentoSelecionado.localizacao].filter(Boolean).join(' · ') || '—'}</b></div>
              </div>
            )}
          </section>

          <section className="checklist-form-bloco">
            <header><h4>Tipo de manutenção</h4></header>
            <select value={form.tipo} onChange={(e) => mudarTipo(e.target.value as TipoChecklist)}>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </select>
          </section>

          <section className="checklist-form-bloco">
            <header><h4>Informações gerais</h4></header>
            <div className="checklist-info-grid">
              <Campo rotulo="Título do checklist">
                <input value={form.titulo} maxLength={160} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder={form.tipo === 'preventiva' ? 'Manutenção preventiva periódica' : 'Correção de falha no equipamento'} />
              </Campo>
              <Campo rotulo="Técnico responsável">
                <input value={form.tecnico_nome} maxLength={120} onChange={(e) => setForm({ ...form, tecnico_nome: e.target.value })}
                  placeholder="Nome do técnico" />
              </Campo>
              <Campo rotulo="Data prevista">
                <input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} />
              </Campo>
            </div>
          </section>

          <div className="checklist-modelo">
            {modelosPorTipo[form.tipo].map((secao) => (
              <section className="checklist-form-bloco checklist-opcoes" key={secao.titulo}>
                <header><h4>{secao.titulo}</h4></header>
                <div className="opcoes-grid">
                  {secao.itens.map((item) => (
                    <label key={item}>
                      <input type="checkbox" checked={form.itens_marcados.includes(item)} onChange={() => alternarItemCriacao(item)} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="checklist-form-bloco">
            <header><h4>Descrição do serviço e observações</h4></header>
            <textarea rows={4} value={form.observacoes} maxLength={2000}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Descreva o diagnóstico, o serviço realizado, peças ou componentes utilizados e recomendações…" />
          </section>
        </div>

        <p className="dica">Marque somente as verificações já realizadas. Itens não aplicáveis podem permanecer desmarcados e ser atualizados durante a execução.</p>
        <div className="modal-acoes">
          <button className="btn" onClick={() => setCriando(false)}>Cancelar</button>
          <button className="btn primario" onClick={() => void criar()}>Criar checklist</button>
        </div>
      </Modal>

      <Modal aberto={!!editando && !!edicao} titulo="Editar checklist" onFechar={() => { setEditando(null); setEdicao(null) }} largura={940}>
        {editando && edicao && (
          <>
            <div className="checklist-formulario">
              <section className="checklist-form-bloco equipamento-bloco">
                <header><ClipboardCheck size={16} /><h4>Equipamento do checklist</h4></header>
                <div className="equipamento-resumo">
                  <div><span>Código</span><b>{editando.equipamentos?.codigo || '—'}</b></div>
                  <div><span>Equipamento</span><b>{editando.equipamentos?.nome || '—'}</b></div>
                  <div><span>Marca / modelo</span><b>{[editando.equipamentos?.marca, editando.equipamentos?.modelo].filter(Boolean).join(' · ') || '—'}</b></div>
                  <div><span>Série / local</span><b>{[editando.equipamentos?.numero_serie, editando.equipamentos?.localizacao].filter(Boolean).join(' · ') || '—'}</b></div>
                </div>
              </section>

              <section className="checklist-form-bloco">
                <header><h4>Informações gerais</h4><Badge tom={editando.tipo === 'preventiva' ? 'azul' : 'roxo'}>{titulo(editando.tipo)}</Badge></header>
                <div className="checklist-edicao-info">
                  <Campo rotulo="Título do checklist">
                    <input value={edicao.titulo} maxLength={160} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} />
                  </Campo>
                  <Campo rotulo="Técnico responsável">
                    <input value={edicao.tecnico_nome} maxLength={120} onChange={(e) => setEdicao({ ...edicao, tecnico_nome: e.target.value })} />
                  </Campo>
                  <Campo rotulo="Data prevista">
                    <input type="date" value={edicao.data_prevista} onChange={(e) => setEdicao({ ...edicao, data_prevista: e.target.value })} />
                  </Campo>
                  <Campo rotulo="Status">
                    <select value={edicao.status} onChange={(e) => setEdicao({ ...edicao, status: e.target.value as StatusChecklist })}>
                      <option value="pendente">Pendente</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </Campo>
                </div>
              </section>

              <div className="checklist-modelo">
                {[...gruposEdicao.entries()].map(([nome, itensGrupo]) => (
                  <section className="checklist-form-bloco checklist-opcoes" key={nome}>
                    <header>
                      <h4>{nome}</h4>
                      <span>{itensGrupo.filter((item) => edicao.itens_marcados.includes(item.id)).length}/{itensGrupo.length}</span>
                    </header>
                    <div className="opcoes-grid">
                      {itensGrupo.map((item) => (
                        <label key={item.id}>
                          <input type="checkbox" checked={edicao.itens_marcados.includes(item.id)} onChange={() => alternarItemEdicao(item.id)} />
                          <span>{item.descricao}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
                {!itensEdicao.length && <p className="sem-itens">Este checklist não possui itens cadastrados.</p>}
              </div>

              <section className="checklist-form-bloco">
                <header><h4>Descrição do serviço e observações</h4></header>
                <textarea rows={4} value={edicao.observacoes} maxLength={2000}
                  onChange={(e) => setEdicao({ ...edicao, observacoes: e.target.value })}
                  placeholder="Descreva o diagnóstico, o serviço realizado, peças utilizadas e recomendações…" />
              </section>
            </div>

            <div className="modal-acoes edicao-acoes">
              <button className="btn perigo" onClick={() => {
                setEditando(null)
                setEdicao(null)
                setExcluir(editando)
              }}><Trash2 size={15} />Excluir</button>
              <div>
                <button className="btn" onClick={() => { setEditando(null); setEdicao(null) }}>Cancelar</button>
                <button className="btn primario" onClick={() => void salvarEdicao()}><Save size={15} />Salvar alterações</button>
              </div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmarExclusao aberto={!!excluir} onCancelar={() => setExcluir(null)} onConfirmar={() => void confirmarExclusao()}
        texto={`Excluir o checklist "${excluir?.titulo}" e todos os seus itens?`} />
    </section>
  )
}
