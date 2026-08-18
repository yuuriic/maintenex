import { useMemo, useState } from 'react'
import { Building2, Plus, Search, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Badge, Campo, ConfirmarExclusao, Modal, Skeleton, StatCard, Vazio } from '../components/ui'
import { data, nf, titulo } from '../lib/format'
import type { Empresa, Profile, StatusEmpresa } from '../lib/types'

const tomStatus: Record<StatusEmpresa, string> = { ativa: 'verde', suspensa: 'ambar', cancelada: 'vermelho' }

function gerarSlug(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function Empresas() {
  const { ehSuperAdmin } = useApp()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [criando, setCriando] = useState(false)
  const [excluir, setExcluir] = useState<Empresa | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: '', cnpj: '', email_principal: '', telefone: '' })

  const { dados, carregando, recarregar } = useConsulta<{ empresas: Empresa[]; usuarios: Profile[] }>(async () => {
    const [emp, usr] = await Promise.all([
      supabase.from('empresas').select('*').order('criado_em', { ascending: false }),
      supabase.from('profiles').select('id, empresa_id, nome, email, papel'),
    ])
    if (emp.error) throw emp.error
    return { empresas: (emp.data ?? []) as Empresa[], usuarios: (usr.data ?? []) as Profile[] }
  }, [])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (dados?.empresas ?? []).filter((e) =>
      !termo || [e.nome, e.slug, e.cnpj, e.email_principal].some((v) => v?.toLowerCase().includes(termo)))
  }, [dados, busca])

  const contagem = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const u of dados?.usuarios ?? []) {
      if (u.empresa_id) mapa[u.empresa_id] = (mapa[u.empresa_id] ?? 0) + 1
    }
    return mapa
  }, [dados])

  if (!ehSuperAdmin) {
    return (
      <section>
        <div className="title-row"><h1>Empresas</h1></div>
        <Vazio texto="Esta área é exclusiva da administração da plataforma." />
      </section>
    )
  }

  async function criar() {
    if (!form.nome.trim()) { toast.erro('Informe o nome da empresa.'); return }
    setSalvando(true)
    const { error } = await supabase.from('empresas').insert({
      nome: form.nome.trim(),
      slug: gerarSlug(form.nome),
      cnpj: form.cnpj.trim() || null,
      email_principal: form.email_principal.trim() || null,
      telefone: form.telefone.trim() || null,
    })
    setSalvando(false)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Empresa criada. Convide o responsável pela aba Equipe.')
    setCriando(false)
    setForm({ nome: '', cnpj: '', email_principal: '', telefone: '' })
    void recarregar()
  }

  async function mudarStatus(empresa: Empresa, status: StatusEmpresa) {
    const { error } = await supabase.from('empresas').update({ status }).eq('id', empresa.id)
    if (error) { toast.erro(error.message); return }
    toast.sucesso(`Empresa marcada como ${status}.`)
    void recarregar()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    const { error } = await supabase.from('empresas').delete().eq('id', excluir.id)
    setExcluir(null)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Empresa excluída.')
    void recarregar()
  }

  const ativas = lista.filter((e) => e.status === 'ativa').length

  return (
    <section>
      <div className="title-row">
        <div><h1>Empresas</h1><p>Administração da plataforma · {nf.format(lista.length)} empresa(s)</p></div>
        <button className="btn primario" onClick={() => setCriando(true)}><Plus size={16} />Nova empresa</button>
      </div>

      <div className="cards">
        <StatCard tom="azul" rotulo="Empresas" valor={nf.format(lista.length)} detalhe="cadastradas" icone={<Building2 size={18} />} />
        <StatCard tom="verde" rotulo="Ativas" valor={nf.format(ativas)} detalhe="em operação" />
        <StatCard tom="roxo" rotulo="Usuários" valor={nf.format(dados?.usuarios.length ?? 0)} detalhe="contas na plataforma" icone={<Users size={18} />} />
        <StatCard tom="ambar" rotulo="Suspensas" valor={nf.format(lista.filter((e) => e.status !== 'ativa').length)} detalhe="sem acesso pleno" />
      </div>

      <div className="filtros">
        <div className="campo-input busca">
          <Search size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, CNPJ ou e-mail…" />
        </div>
      </div>

      {carregando ? <Skeleton /> : !lista.length ? <Vazio texto="Nenhuma empresa cadastrada" /> : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr><th>Empresa</th><th>Identificador</th><th>Responsável</th><th>Usuários</th><th>Criada em</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="celula-principal">
                      <Building2 size={16} />
                      <div><b>{e.nome}</b><small>{e.cnpj ?? 'Sem CNPJ'}</small></div>
                    </div>
                  </td>
                  <td><code>{e.slug}</code></td>
                  <td>{e.email_principal ?? '—'}</td>
                  <td>{nf.format(contagem[e.id] ?? 0)}</td>
                  <td>{data(e.criado_em)}</td>
                  <td>
                    <select value={e.status} onChange={(ev) => void mudarStatus(e, ev.target.value as StatusEmpresa)}>
                      <option value="ativa">Ativa</option>
                      <option value="suspensa">Suspensa</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </td>
                  <td className="acoes">
                    <Badge tom={tomStatus[e.status]}>{titulo(e.status)}</Badge>
                    <button className="icone-btn perigo" onClick={() => setExcluir(e)} aria-label="Excluir"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal aberto={criando} titulo="Nova empresa" onFechar={() => setCriando(false)}>
        <div className="form-grid">
          <Campo rotulo="Nome"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Transportes Lelac" /></Campo>
          <Campo rotulo="CNPJ"><input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></Campo>
          <Campo rotulo="E-mail do responsável"><input type="email" value={form.email_principal} onChange={(e) => setForm({ ...form, email_principal: e.target.value })} /></Campo>
          <Campo rotulo="Telefone"><input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Campo>
        </div>
        <p className="dica">
          Identificador gerado: <code>{gerarSlug(form.nome) || '—'}</code>. Depois de criar, envie um convite
          com papel <b>owner</b> para o e-mail do responsável.
        </p>
        <div className="modal-acoes">
          <button className="btn" onClick={() => setCriando(false)}>Cancelar</button>
          <button className="btn primario" onClick={() => void criar()} disabled={salvando}>Criar empresa</button>
        </div>
      </Modal>

      <ConfirmarExclusao aberto={!!excluir} onCancelar={() => setExcluir(null)} onConfirmar={() => void confirmarExclusao()}
        texto={`Excluir ${excluir?.nome}? Todos os dados da empresa (cidades, equipamentos, checklists, estoque e pendências) serão removidos em cascata.`} />
    </section>
  )
}
