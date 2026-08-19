import { useEffect, useState } from 'react'
import {
  Building2, Copy, Mail, MapPin, Moon, Plus, Sun, Trash2, UserCog, UserPlus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../components/Toast'
import { Badge, Campo, ConfirmarExclusao, Painel, Vazio } from '../components/ui'
import { data, titulo } from '../lib/format'
import type { Cidade, Convite, Empresa, PapelUsuario, Profile, Setor } from '../lib/types'

type Aba = 'perfil' | 'empresa' | 'cidades' | 'setores' | 'equipe'

const PAPEIS_ATRIBUIVEIS: { valor: PapelUsuario; rotulo: string; descricao: string }[] = [
  { valor: 'owner', rotulo: 'Responsável', descricao: 'Administra a empresa e convida usuários' },
  { valor: 'gestor', rotulo: 'Gestor', descricao: 'Cadastra e acompanha toda a operação' },
  { valor: 'tecnico', rotulo: 'Técnico', descricao: 'Executa checklists e movimenta estoque' },
  { valor: 'leitor', rotulo: 'Leitor', descricao: 'Apenas consulta' },
]

const tomPapel: Record<PapelUsuario, string> = {
  super_admin: 'roxo', owner: 'azul', gestor: 'verde', tecnico: 'cinza', leitor: 'cinza',
}

export default function Configuracoes() {
  const { tema, alternarTema, cidades, setores, cidadeId, empresaId, podeAdministrar, recarregarEscopo } = useApp()
  const { profile, atualizarPerfil, user } = useAuth()
  const toast = useToast()
  const [aba, setAba] = useState<Aba>('perfil')
  const [nome, setNome] = useState(profile?.nome ?? '')
  const [salvando, setSalvando] = useState(false)
  const [novaCidade, setNovaCidade] = useState({ nome: '', uf: '' })
  const [novoSetor, setNovoSetor] = useState({ nome: '', responsavel: '' })
  const [convite, setConvite] = useState({ email: '', papel: 'tecnico' as PapelUsuario })
  const [empresaForm, setEmpresaForm] = useState({ nome: '', cnpj: '', email_principal: '', telefone: '' })
  const [excluirCidade, setExcluirCidade] = useState<Cidade | null>(null)
  const [excluirSetor, setExcluirSetor] = useState<Setor | null>(null)

  useEffect(() => { setNome(profile?.nome ?? '') }, [profile?.nome])

  const { dados: empresa, recarregar: recarregarEmpresa } = useConsulta<Empresa | null>(async () => {
    if (!empresaId) return null
    const { data: linha, error } = await supabase.from('empresas').select('*').eq('id', empresaId).maybeSingle()
    if (error) throw error
    return (linha as Empresa | null) ?? null
  }, [empresaId])

  useEffect(() => {
    if (!empresa) return
    setEmpresaForm({
      nome: empresa.nome,
      cnpj: empresa.cnpj ?? '',
      email_principal: empresa.email_principal ?? '',
      telefone: empresa.telefone ?? '',
    })
  }, [empresa])

  const { dados: equipe, recarregar: recarregarEquipe } = useConsulta<Profile[]>(async () => {
    if (!empresaId) return []
    const { data: linhas, error } = await supabase.from('profiles').select('*').eq('empresa_id', empresaId).order('nome')
    if (error) throw error
    return (linhas ?? []) as Profile[]
  }, [empresaId])

  const { dados: convites, recarregar: recarregarConvites } = useConsulta<Convite[]>(async () => {
    if (!empresaId) return []
    const { data: linhas, error } = await supabase
      .from('convites').select('*').eq('empresa_id', empresaId).order('criado_em', { ascending: false })
    if (error) throw error
    return (linhas ?? []) as Convite[]
  }, [empresaId])

  async function salvarPerfil() {
    setSalvando(true)
    try {
      await atualizarPerfil({ nome, cidade_id: cidadeId })
      toast.sucesso('Perfil atualizado.')
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarEmpresa() {
    if (!empresaId) return
    setSalvando(true)
    const { error } = await supabase.from('empresas').update({
      nome: empresaForm.nome,
      cnpj: empresaForm.cnpj || null,
      email_principal: empresaForm.email_principal || null,
      telefone: empresaForm.telefone || null,
    }).eq('id', empresaId)
    setSalvando(false)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Dados da empresa atualizados.')
    void recarregarEmpresa()
  }

  async function criarCidade() {
    if (!empresaId) { toast.erro('Conta sem empresa vinculada.'); return }
    if (!novaCidade.nome || novaCidade.uf.length !== 2) { toast.erro('Informe nome e UF (2 letras).'); return }
    const { error } = await supabase.from('cidades').insert({
      empresa_id: empresaId, nome: novaCidade.nome, uf: novaCidade.uf.toUpperCase(),
    })
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Cidade criada.')
    setNovaCidade({ nome: '', uf: '' })
    void recarregarEscopo()
  }

  async function criarSetor() {
    if (!cidadeId || !empresaId) { toast.erro('Selecione uma cidade no topo.'); return }
    if (!novoSetor.nome) { toast.erro('Informe o nome do setor.'); return }
    const { error } = await supabase.from('setores').insert({
      empresa_id: empresaId, cidade_id: cidadeId,
      nome: novoSetor.nome, responsavel: novoSetor.responsavel || null,
    })
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Setor criado.')
    setNovoSetor({ nome: '', responsavel: '' })
    void recarregarEscopo()
  }

  async function enviarConvite() {
    if (!empresaId) { toast.erro('Conta sem empresa vinculada.'); return }
    const email = convite.email.trim().toLowerCase()
    if (!email.includes('@')) { toast.erro('Informe um e-mail válido.'); return }

    const { error } = await supabase.from('convites').upsert({
      empresa_id: empresaId, email, papel: convite.papel, criado_por: profile?.id ?? null,
      aceito_em: null, expira_em: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    }, { onConflict: 'empresa_id,email' })

    if (error) { toast.erro(error.message); return }
    toast.sucesso('Convite registrado. Ao criar a conta com este e-mail, o usuário entra na empresa.')
    setConvite({ email: '', papel: 'tecnico' })
    void recarregarConvites()
  }

  async function removerConvite(id: string) {
    const { error } = await supabase.from('convites').delete().eq('id', id)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Convite removido.')
    void recarregarConvites()
  }

  async function mudarPapel(id: string, papel: PapelUsuario) {
    const { error } = await supabase.from('profiles').update({ papel }).eq('id', id)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Papel atualizado.')
    void recarregarEquipe()
  }

  async function alternarAtivo(p: Profile) {
    const { error } = await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    if (error) { toast.erro(error.message); return }
    void recarregarEquipe()
  }

  async function removerCidade() {
    if (!excluirCidade) return
    const { error } = await supabase.from('cidades').delete().eq('id', excluirCidade.id)
    setExcluirCidade(null)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Cidade removida.')
    void recarregarEscopo()
  }

  async function removerSetor() {
    if (!excluirSetor) return
    const { error } = await supabase.from('setores').delete().eq('id', excluirSetor.id)
    setExcluirSetor(null)
    if (error) { toast.erro(error.message); return }
    toast.sucesso('Setor removido.')
    void recarregarEscopo()
  }

  const abas: { chave: Aba; rotulo: string }[] = [
    { chave: 'perfil', rotulo: 'Meu perfil' },
    { chave: 'empresa', rotulo: 'Empresa' },
    { chave: 'cidades', rotulo: 'Cidades' },
    { chave: 'setores', rotulo: 'Setores' },
    { chave: 'equipe', rotulo: 'Equipe' },
  ]

  return (
    <section>
      <div className="title-row">
        <div>
          <h1>Configurações</h1>
          <p>{empresa?.nome ?? 'Plataforma'} · perfil, escopo geográfico e equipe</p>
        </div>
        <Badge tom={tomPapel[profile?.papel ?? 'leitor']}>{titulo(profile?.papel ?? 'leitor')}</Badge>
      </div>

      <div className="abas" role="tablist">
        {abas.map((a) => (
          <button key={a.chave} role="tab" aria-selected={aba === a.chave}
            className={aba === a.chave ? 'ativo' : ''} onClick={() => setAba(a.chave)}>
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'perfil' && (
        <div className="config-grid">
          <Painel titulo="Dados da conta">
            <div className="form-grid">
              <Campo rotulo="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
              <Campo rotulo="E-mail"><input value={user?.email ?? ''} disabled /></Campo>
              <Campo rotulo="Papel"><input value={titulo(profile?.papel ?? '')} disabled /></Campo>
              <Campo rotulo="Conta criada em"><input value={data(profile?.criado_em)} disabled /></Campo>
            </div>
            <p className="dica">O próprio usuário não altera seu papel — isso é feito pelo responsável da empresa.</p>
            <div className="modal-acoes">
              <button className="btn primario" onClick={() => void salvarPerfil()} disabled={salvando}>
                <UserCog size={16} />{salvando ? 'Salvando…' : 'Salvar perfil'}
              </button>
            </div>
          </Painel>

          <Painel titulo="Aparência">
            <div className="tema-toggle">
              <div>
                <b>Tema {tema === 'escuro' ? 'escuro' : 'claro'}</b>
                <small>Preferência salva neste navegador.</small>
              </div>
              <button className="btn" onClick={alternarTema}>
                {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}Alternar
              </button>
            </div>
            <div className="atalhos">
              <b>Atalhos</b>
              <ul><li><kbd>⌘</kbd>+<kbd>K</kbd> busca rápida</li><li><kbd>Esc</kbd> fecha modais</li></ul>
            </div>
          </Painel>
        </div>
      )}

      {aba === 'empresa' && (
        <Painel titulo="Dados da empresa">
          {!empresa ? <Vazio texto="Conta sem empresa vinculada" compacto /> : (
            <>
              <div className="form-grid">
                <Campo rotulo="Nome">
                  <input value={empresaForm.nome} disabled={!podeAdministrar}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })} />
                </Campo>
                <Campo rotulo="Identificador"><input value={empresa.slug} disabled /></Campo>
                <Campo rotulo="CNPJ">
                  <input value={empresaForm.cnpj} disabled={!podeAdministrar}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })} />
                </Campo>
                <Campo rotulo="E-mail principal">
                  <input type="email" value={empresaForm.email_principal} disabled={!podeAdministrar}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, email_principal: e.target.value })} />
                </Campo>
                <Campo rotulo="Telefone">
                  <input value={empresaForm.telefone} disabled={!podeAdministrar}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })} />
                </Campo>
                <Campo rotulo="Criada em"><input value={data(empresa.criado_em)} disabled /></Campo>
              </div>
              {podeAdministrar && (
                <div className="modal-acoes">
                  <button className="btn primario" onClick={() => void salvarEmpresa()} disabled={salvando}>
                    <Building2 size={16} />Salvar empresa
                  </button>
                </div>
              )}
            </>
          )}
        </Painel>
      )}

      {aba === 'cidades' && (
        <Painel titulo="Cidades atendidas">
          <div className="linha-form">
            <input placeholder="Nome da cidade" value={novaCidade.nome}
              onChange={(e) => setNovaCidade({ ...novaCidade, nome: e.target.value })} />
            <input placeholder="UF" maxLength={2} className="curto" value={novaCidade.uf}
              onChange={(e) => setNovaCidade({ ...novaCidade, uf: e.target.value.toUpperCase() })} />
            <button className="btn primario" onClick={() => void criarCidade()}><Plus size={16} />Adicionar</button>
          </div>
          {!cidades.filter((c) => c.empresa_id === empresaId).length ? <Vazio texto="Nenhuma cidade cadastrada" compacto /> : (
            <ul className="lista-simples">
              {cidades.filter((c) => c.empresa_id === empresaId).map((c) => (
                <li key={c.id}>
                  <div className="celula-principal">
                    <MapPin size={16} />
                    <div><b>{c.nome}</b><small>{c.uf}</small></div>
                  </div>
                  <div className="acoes">
                    {c.id === cidadeId && <Badge tom="azul">Ativa</Badge>}
                    <button className="icone-btn perigo" onClick={() => setExcluirCidade(c)} aria-label="Excluir"><Trash2 size={15} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      )}

      {aba === 'setores' && (
        <Painel titulo="Setores da cidade selecionada">
          <div className="linha-form">
            <input placeholder="Nome do setor" value={novoSetor.nome}
              onChange={(e) => setNovoSetor({ ...novoSetor, nome: e.target.value })} />
            <input placeholder="Responsável" value={novoSetor.responsavel}
              onChange={(e) => setNovoSetor({ ...novoSetor, responsavel: e.target.value })} />
            <button className="btn primario" onClick={() => void criarSetor()}><Plus size={16} />Adicionar</button>
          </div>
          {!setores.length ? <Vazio texto="Nenhum setor nesta cidade" compacto /> : (
            <ul className="lista-simples">
              {setores.map((s) => (
                <li key={s.id}>
                  <div className="celula-principal">
                    <Building2 size={16} />
                    <div><b>{s.nome}</b><small>{s.responsavel ?? 'Sem responsável'}</small></div>
                  </div>
                  <button className="icone-btn perigo" onClick={() => setExcluirSetor(s)} aria-label="Excluir"><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      )}

      {aba === 'equipe' && (
        <div className="config-grid">
          <Painel titulo="Usuários da empresa">
            {!equipe?.length ? <Vazio texto="Nenhum usuário" compacto /> : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th></tr></thead>
                  <tbody>
                    {equipe.map((p) => (
                      <tr key={p.id}>
                        <td><b>{p.nome}</b>{p.id === profile?.id && <Badge tom="azul">você</Badge>}</td>
                        <td>{p.email}</td>
                        <td>
                          {podeAdministrar && p.id !== profile?.id && p.papel !== 'super_admin' ? (
                            <select value={p.papel} onChange={(e) => void mudarPapel(p.id, e.target.value as PapelUsuario)}>
                              {PAPEIS_ATRIBUIVEIS.map((op) => <option key={op.valor} value={op.valor}>{op.rotulo}</option>)}
                            </select>
                          ) : (
                            <Badge tom={tomPapel[p.papel]}>{titulo(p.papel)}</Badge>
                          )}
                        </td>
                        <td>
                          {podeAdministrar && p.id !== profile?.id ? (
                            <button className="btn mini" onClick={() => void alternarAtivo(p)}>
                              {p.ativo ? 'Desativar' : 'Reativar'}
                            </button>
                          ) : (
                            <Badge tom={p.ativo ? 'verde' : 'cinza'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          <Painel titulo="Convites">
            {!podeAdministrar ? (
              <Vazio texto="Somente o responsável da empresa convida usuários." compacto />
            ) : (
              <>
                <div className="form-grid">
                  <Campo rotulo="E-mail">
                    <input type="email" placeholder="pessoa@empresa.com.br" value={convite.email}
                      onChange={(e) => setConvite({ ...convite, email: e.target.value })} />
                  </Campo>
                  <Campo rotulo="Papel">
                    <select value={convite.papel} onChange={(e) => setConvite({ ...convite, papel: e.target.value as PapelUsuario })}>
                      {PAPEIS_ATRIBUIVEIS.map((op) => <option key={op.valor} value={op.valor}>{op.rotulo}</option>)}
                    </select>
                  </Campo>
                </div>
                <p className="dica">
                  {PAPEIS_ATRIBUIVEIS.find((p) => p.valor === convite.papel)?.descricao}. Quando a pessoa criar
                  a conta com este e-mail, ela entra automaticamente na empresa com o papel escolhido.
                </p>
                <div className="modal-acoes">
                  <button className="btn primario" onClick={() => void enviarConvite()}>
                    <UserPlus size={16} />Registrar convite
                  </button>
                </div>
              </>
            )}

            {!convites?.length ? <Vazio texto="Nenhum convite" compacto /> : (
              <ul className="lista-simples">
                {convites.map((c) => {
                  const expirado = !c.aceito_em && new Date(c.expira_em) < new Date()
                  return (
                    <li key={c.id}>
                      <div className="celula-principal">
                        <Mail size={16} />
                        <div><b>{c.email}</b><small>{titulo(c.papel)} · expira {data(c.expira_em)}</small></div>
                      </div>
                      <div className="acoes">
                        <Badge tom={c.aceito_em ? 'verde' : expirado ? 'vermelho' : 'ambar'}>
                          {c.aceito_em ? 'Aceito' : expirado ? 'Expirado' : 'Pendente'}
                        </Badge>
                        <button className="icone-btn" aria-label="Copiar link de cadastro"
                          onClick={() => {
                            void navigator.clipboard.writeText(`${window.location.origin}/login?modo=cadastrar`)
                            toast.info('Link de cadastro copiado.')
                          }}>
                          <Copy size={15} />
                        </button>
                        {podeAdministrar && (
                          <button className="icone-btn perigo" onClick={() => void removerConvite(c.id)} aria-label="Remover">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Painel>
        </div>
      )}

      <ConfirmarExclusao aberto={!!excluirCidade} onCancelar={() => setExcluirCidade(null)} onConfirmar={() => void removerCidade()}
        texto={`Excluir ${excluirCidade?.nome}? Todos os setores, equipamentos e registros da cidade serão removidos em cascata.`} />
      <ConfirmarExclusao aberto={!!excluirSetor} onCancelar={() => setExcluirSetor(null)} onConfirmar={() => void removerSetor()}
        texto={`Excluir o setor ${excluirSetor?.nome}? Os equipamentos ficarão sem setor.`} />
    </section>
  )
}
