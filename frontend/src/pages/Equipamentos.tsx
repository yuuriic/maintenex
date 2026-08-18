import { useMemo, useState } from 'react'
import { Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Badge, Campo, ConfirmarExclusao, Modal, Skeleton, Vazio } from '../components/ui'
import { data, nf, titulo } from '../lib/format'
import type { Equipamento, StatusEquipamento } from '../lib/types'

const tomStatus: Record<StatusEquipamento, string> = {
  ativo: 'verde', manutencao: 'ambar', inativo: 'cinza',
}

const vazio = {
  codigo: '', nome: '', marca: '', modelo: '', numero_serie: '',
  localizacao: '', status: 'ativo' as StatusEquipamento, contador: 0,
  setor_id: '', ultima_manutencao: '', proxima_manutencao: '',
}

export default function Equipamentos() {
  const { cidadeId, setorId, setores, empresaId } = useApp()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusEquipamento>('todos')
  const [editando, setEditando] = useState<Equipamento | null>(null)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState(vazio)
  const [excluir, setExcluir] = useState<Equipamento | null>(null)
  const [salvando, setSalvando] = useState(false)

  const { dados, carregando, recarregar } = useConsulta<Equipamento[]>(async () => {
    let q = supabase.from('equipamentos').select('*, setores(id, nome)').order('codigo')
    if (cidadeId) q = q.eq('cidade_id', cidadeId)
    if (setorId) q = q.eq('setor_id', setorId)
    const { data: linhas, error } = await q
    if (error) throw error
    return (linhas ?? []) as Equipamento[]
  }, [cidadeId, setorId])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (dados ?? []).filter((e) => {
      const casaBusca = !termo || [e.codigo, e.nome, e.marca, e.modelo, e.numero_serie, e.localizacao]
        .some((v) => v?.toLowerCase().includes(termo))
      const casaStatus = filtroStatus === 'todos' || e.status === filtroStatus
      return casaBusca && casaStatus
    })
  }, [dados, busca, filtroStatus])

  function abrirNovo() {
    setForm({ ...vazio, setor_id: setorId ?? '' })
    setCriando(true)
  }

  function abrirEdicao(e: Equipamento) {
    setForm({
      codigo: e.codigo, nome: e.nome, marca: e.marca ?? '', modelo: e.modelo ?? '',
      numero_serie: e.numero_serie ?? '', localizacao: e.localizacao ?? '', status: e.status,
      contador: e.contador, setor_id: e.setor_id ?? '',
      ultima_manutencao: e.ultima_manutencao ?? '', proxima_manutencao: e.proxima_manutencao ?? '',
    })
    setEditando(e)
  }

  async function salvar() {
    if (!cidadeId) { toast.erro('Selecione uma cidade no topo antes de cadastrar.'); return }
    setSalvando(true)
    const payload = {
      ...form,
      empresa_id: empresaId,
      cidade_id: cidadeId,
      setor_id: form.setor_id || null,
      contador: Number(form.contador) || 0,
      ultima_manutencao: form.ultima_manutencao || null,
      proxima_manutencao: form.proxima_manutencao || null,
    }
    const { error } = editando
      ? await supabase.from('equipamentos').update(payload).eq('id', editando.id)
      : await supabase.from('equipamentos').insert(payload)
    setSalvando(false)

    if (error) { toast.erro(error.message); return }
    toast.sucesso(editando ? 'Equipamento atualizado.' : 'Equipamento cadastrado.')
    setEditando(null); setCriando(false)
    void recarregar()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    const { error } = await supabase.from('equipamentos').delete().eq('id', excluir.id)
    setExcluir(null)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Equipamento excluído.')
    void recarregar()
  }

  return (
    <section>
      <div className="title-row">
        <div>
          <h1>Equipamentos</h1>
          <p>{nf.format(lista.length)} equipamento(s) no escopo atual</p>
        </div>
        <button className="btn primario" onClick={abrirNovo}><Plus size={16} />Novo equipamento</button>
      </div>

      <div className="filtros">
        <div className="campo-input busca">
          <Search size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, nome, série ou local…" />
        </div>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="manutencao">Em manutenção</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {carregando ? <Skeleton /> : !lista.length ? <Vazio texto="Nenhum equipamento encontrado" /> : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Código</th><th>Equipamento</th><th>Setor</th><th>Local</th>
                <th>Contador</th><th>Próxima manut.</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td><code>{e.codigo}</code></td>
                  <td>
                    <div className="celula-principal">
                      <Printer size={16} />
                      <div><b>{e.nome}</b><small>{[e.marca, e.modelo].filter(Boolean).join(' · ') || '—'}</small></div>
                    </div>
                  </td>
                  <td>{e.setores?.nome ?? '—'}</td>
                  <td>{e.localizacao ?? '—'}</td>
                  <td>{nf.format(e.contador)}</td>
                  <td>{data(e.proxima_manutencao)}</td>
                  <td><Badge tom={tomStatus[e.status]}>{titulo(e.status)}</Badge></td>
                  <td className="acoes">
                    <button className="icone-btn" onClick={() => abrirEdicao(e)} aria-label="Editar"><Pencil size={15} /></button>
                    <button className="icone-btn perigo" onClick={() => setExcluir(e)} aria-label="Excluir"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal aberto={criando || !!editando} titulo={editando ? 'Editar equipamento' : 'Novo equipamento'}
        onFechar={() => { setCriando(false); setEditando(null) }} largura={640}>
        <div className="form-grid">
          <Campo rotulo="Código"><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="EQP-0001" /></Campo>
          <Campo rotulo="Nome"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Multifuncional A3" /></Campo>
          <Campo rotulo="Marca"><input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></Campo>
          <Campo rotulo="Modelo"><input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></Campo>
          <Campo rotulo="Número de série"><input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} /></Campo>
          <Campo rotulo="Localização"><input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} /></Campo>
          <Campo rotulo="Setor">
            <select value={form.setor_id} onChange={(e) => setForm({ ...form, setor_id: e.target.value })}>
              <option value="">Sem setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusEquipamento })}>
              <option value="ativo">Ativo</option>
              <option value="manutencao">Em manutenção</option>
              <option value="inativo">Inativo</option>
            </select>
          </Campo>
          <Campo rotulo="Contador"><input type="number" value={form.contador} onChange={(e) => setForm({ ...form, contador: Number(e.target.value) })} /></Campo>
          <Campo rotulo="Última manutenção"><input type="date" value={form.ultima_manutencao} onChange={(e) => setForm({ ...form, ultima_manutencao: e.target.value })} /></Campo>
          <Campo rotulo="Próxima manutenção"><input type="date" value={form.proxima_manutencao} onChange={(e) => setForm({ ...form, proxima_manutencao: e.target.value })} /></Campo>
        </div>
        <div className="modal-acoes">
          <button className="btn" onClick={() => { setCriando(false); setEditando(null) }}>Cancelar</button>
          <button className="btn primario" onClick={() => void salvar()} disabled={salvando || !form.codigo || !form.nome}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Modal>

      <ConfirmarExclusao aberto={!!excluir} onCancelar={() => setExcluir(null)} onConfirmar={() => void confirmarExclusao()}
        texto={`Excluir o equipamento ${excluir?.codigo}? Checklists e movimentações vinculadas também serão afetados.`} />
    </section>
  )
}
