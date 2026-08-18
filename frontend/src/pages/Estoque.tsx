import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, PackageSearch, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Badge, Campo, Modal, Painel, Skeleton, StatCard, Vazio } from '../components/ui'
import { baixarCsv, dataHora, nf } from '../lib/format'
import type { Estoque as EstoqueTipo, Material, Movimentacao, TipoMovimentacao } from '../lib/types'

export default function Estoque() {
  const { cidadeId, cidadeAtual, empresaId } = useApp()
  const { profile } = useAuth()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [somenteBaixo, setSomenteBaixo] = useState(false)
  const [movModal, setMovModal] = useState(false)
  const [matModal, setMatModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mov, setMov] = useState({ material_id: '', tipo: 'entrada' as TipoMovimentacao, quantidade: 1, motivo: '' })
  const [mat, setMat] = useState({ codigo: '', nome: '', categoria: '', unidade: 'un', estoque_minimo: 0 })

  const { dados: materiais, recarregar: recarregarMateriais } = useConsulta<Material[]>(async () => {
    const { data, error } = await supabase.from('materiais').select('*').order('nome')
    if (error) throw error
    return (data ?? []) as Material[]
  }, [])

  const { dados: saldos, carregando, recarregar } = useConsulta<EstoqueTipo[]>(async () => {
    let q = supabase.from('estoque').select('*, materiais(*)')
    if (cidadeId) q = q.eq('cidade_id', cidadeId)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as EstoqueTipo[]
  }, [cidadeId])

  const { dados: movimentacoes, recarregar: recarregarMov } = useConsulta<Movimentacao[]>(async () => {
    let q = supabase.from('movimentacoes')
      .select('*, materiais(id, codigo, nome, unidade)')
      .order('criado_em', { ascending: false }).limit(25)
    if (cidadeId) q = q.eq('cidade_id', cidadeId)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as Movimentacao[]
  }, [cidadeId])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (saldos ?? [])
      .filter((s) => {
        const m = s.materiais
        const casaBusca = !termo || [m?.codigo, m?.nome, m?.categoria].some((v) => v?.toLowerCase().includes(termo))
        const baixo = !somenteBaixo || s.quantidade <= (m?.estoque_minimo ?? 0)
        return casaBusca && baixo
      })
      .sort((a, b) => (a.materiais?.nome ?? '').localeCompare(b.materiais?.nome ?? ''))
  }, [saldos, busca, somenteBaixo])

  const kpis = useMemo(() => {
    const todos = saldos ?? []
    return {
      itens: todos.length,
      unidades: todos.reduce((soma, s) => soma + s.quantidade, 0),
      abaixoMinimo: todos.filter((s) => s.quantidade <= (s.materiais?.estoque_minimo ?? 0)).length,
      zerados: todos.filter((s) => s.quantidade === 0).length,
    }
  }, [saldos])

  async function registrarMovimentacao() {
    if (!cidadeId) { toast.erro('Selecione uma cidade no topo.'); return }
    if (!mov.material_id || mov.quantidade <= 0) { toast.erro('Informe material e quantidade.'); return }
    setSalvando(true)
    const { error } = await supabase.from('movimentacoes').insert({
      empresa_id: empresaId,
      material_id: mov.material_id,
      cidade_id: cidadeId,
      tipo: mov.tipo,
      quantidade: Number(mov.quantidade),
      motivo: mov.motivo || null,
      usuario_id: profile?.id ?? null,
    })
    setSalvando(false)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Movimentação registrada — saldo atualizado.')
    setMovModal(false)
    setMov({ material_id: '', tipo: 'entrada', quantidade: 1, motivo: '' })
    void recarregar(); void recarregarMov()
  }

  async function criarMaterial() {
    if (!mat.codigo || !mat.nome) { toast.erro('Informe código e nome.'); return }
    setSalvando(true)
    const { error } = await supabase.from('materiais').insert({
      ...mat,
      empresa_id: empresaId,
      estoque_minimo: Number(mat.estoque_minimo) || 0,
      categoria: mat.categoria || null,
    })
    setSalvando(false)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Material cadastrado.')
    setMatModal(false)
    setMat({ codigo: '', nome: '', categoria: '', unidade: 'un', estoque_minimo: 0 })
    void recarregarMateriais()
  }

  function exportar() {
    baixarCsv('estoque.csv', lista.map((s) => ({
      codigo: s.materiais?.codigo, material: s.materiais?.nome, categoria: s.materiais?.categoria ?? '',
      unidade: s.materiais?.unidade, quantidade: s.quantidade, minimo: s.materiais?.estoque_minimo,
      cidade: cidadeAtual?.nome ?? '', atualizado_em: s.atualizado_em,
    })))
    toast.info('CSV gerado.')
  }

  return (
    <section>
      <div className="title-row">
        <div><h1>Estoque Geral</h1><p>{cidadeAtual ? `${cidadeAtual.nome} - ${cidadeAtual.uf}` : 'Todas as cidades'}</p></div>
        <div className="acoes-topo">
          <button className="btn" onClick={() => setMatModal(true)}><Plus size={16} />Material</button>
          <button className="btn" onClick={exportar}>Exportar CSV</button>
          <button className="btn primario" onClick={() => setMovModal(true)}><SlidersHorizontal size={16} />Movimentar</button>
        </div>
      </div>

      <div className="cards">
        <StatCard rotulo="Itens em estoque" valor={nf.format(kpis.itens)} detalhe="materiais com saldo" tom="azul" icone={<PackageSearch size={18} />} />
        <StatCard rotulo="Unidades totais" valor={nf.format(kpis.unidades)} detalhe="soma das quantidades" tom="verde" />
        <StatCard rotulo="Abaixo do mínimo" valor={nf.format(kpis.abaixoMinimo)} detalhe="requer reposição" tom="ambar" />
        <StatCard rotulo="Zerados" valor={nf.format(kpis.zerados)} detalhe="sem saldo disponível" tom="vermelho" />
      </div>

      <div className="filtros">
        <div className="campo-input busca">
          <Search size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar material…" />
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={somenteBaixo} onChange={(e) => setSomenteBaixo(e.target.checked)} />
          Só abaixo do mínimo
        </label>
      </div>

      <div className="estoque-grid">
        <Painel titulo="Saldos">
          {carregando ? <Skeleton /> : !lista.length ? <Vazio texto="Nenhum material no escopo" compacto /> : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead><tr><th>Código</th><th>Material</th><th>Categoria</th><th>Saldo</th><th>Mínimo</th><th>Status</th></tr></thead>
                <tbody>
                  {lista.map((s) => {
                    const minimo = s.materiais?.estoque_minimo ?? 0
                    const critico = s.quantidade === 0
                    const baixo = !critico && s.quantidade <= minimo
                    return (
                      <tr key={s.id}>
                        <td><code>{s.materiais?.codigo}</code></td>
                        <td><b>{s.materiais?.nome}</b></td>
                        <td>{s.materiais?.categoria ?? '—'}</td>
                        <td>{nf.format(s.quantidade)} {s.materiais?.unidade}</td>
                        <td>{nf.format(minimo)}</td>
                        <td>
                          <Badge tom={critico ? 'vermelho' : baixo ? 'ambar' : 'verde'}>
                            {critico ? 'Zerado' : baixo ? 'Repor' : 'Normal'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Painel>

        <Painel titulo="Últimas movimentações">
          {!movimentacoes?.length ? <Vazio texto="Nenhuma movimentação" compacto /> : (
            <ul className="timeline">
              {movimentacoes.map((m) => (
                <li key={m.id}>
                  <span className={`mov-icone ${m.tipo}`}>
                    {m.tipo === 'entrada' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  </span>
                  <div>
                    <b>{m.materiais?.nome}</b>
                    <small>
                      {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : '='}{nf.format(m.quantidade)} {m.materiais?.unidade}
                      {m.motivo ? ` · ${m.motivo}` : ''}
                    </small>
                    <time>{dataHora(m.criado_em)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <Modal aberto={movModal} titulo="Registrar movimentação" onFechar={() => setMovModal(false)}>
        <div className="form-grid">
          <Campo rotulo="Material">
            <select value={mov.material_id} onChange={(e) => setMov({ ...mov, material_id: e.target.value })}>
              <option value="">Selecione…</option>
              {(materiais ?? []).map((m) => <option key={m.id} value={m.id}>{m.codigo} — {m.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo">
            <select value={mov.tipo} onChange={(e) => setMov({ ...mov, tipo: e.target.value as TipoMovimentacao })}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste (define o saldo)</option>
            </select>
          </Campo>
          <Campo rotulo="Quantidade"><input type="number" min={1} value={mov.quantidade} onChange={(e) => setMov({ ...mov, quantidade: Number(e.target.value) })} /></Campo>
          <Campo rotulo="Motivo"><input value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })} placeholder="Consumo em preventiva" /></Campo>
        </div>
        <div className="modal-acoes">
          <button className="btn" onClick={() => setMovModal(false)}>Cancelar</button>
          <button className="btn primario" onClick={() => void registrarMovimentacao()} disabled={salvando}>Registrar</button>
        </div>
      </Modal>

      <Modal aberto={matModal} titulo="Novo material" onFechar={() => setMatModal(false)}>
        <div className="form-grid">
          <Campo rotulo="Código"><input value={mat.codigo} onChange={(e) => setMat({ ...mat, codigo: e.target.value })} placeholder="MAT-009" /></Campo>
          <Campo rotulo="Nome"><input value={mat.nome} onChange={(e) => setMat({ ...mat, nome: e.target.value })} /></Campo>
          <Campo rotulo="Categoria"><input value={mat.categoria} onChange={(e) => setMat({ ...mat, categoria: e.target.value })} /></Campo>
          <Campo rotulo="Unidade"><input value={mat.unidade} onChange={(e) => setMat({ ...mat, unidade: e.target.value })} /></Campo>
          <Campo rotulo="Estoque mínimo"><input type="number" min={0} value={mat.estoque_minimo} onChange={(e) => setMat({ ...mat, estoque_minimo: Number(e.target.value) })} /></Campo>
        </div>
        <div className="modal-acoes">
          <button className="btn" onClick={() => setMatModal(false)}>Cancelar</button>
          <button className="btn primario" onClick={() => void criarMaterial()} disabled={salvando}>Cadastrar</button>
        </div>
      </Modal>
    </section>
  )
}
