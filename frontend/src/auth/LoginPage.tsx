import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { aplicarSeo } from '../lib/seo'
import { useAuth } from './AuthProvider'
import { supabaseConfigurado } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Aurora from '../components/ui/aurora'

type Modo = 'entrar' | 'cadastrar' | 'recuperar'

const destaques = [
  ['Checklists preventivos', 'Rotinas por equipamento com histórico completo.'],
  ['Estoque em tempo real', 'Movimentações que atualizam o saldo na hora.'],
  ['Pendências com SLA', 'Prioridade, responsável e tempo de resposta.'],
]

export default function LoginPage() {
  const { session, recuperandoSenha, entrar, cadastrar, recuperarSenha } = useAuth()
  const toast = useToast()
  const [params] = useSearchParams()
  const [modo, setModo] = useState<Modo>(params.get('modo') === 'cadastrar' ? 'cadastrar' : 'entrar')
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    aplicarSeo({
      titulo: 'Entrar no Maintenex',
      descricao: 'Acesse o painel de gestão de manutenção do Maintenex.',
      caminho: '/login',
      noindex: true,
    })
  }, [])

  // O link do Supabase cria uma sessão temporária. Ela serve apenas para trocar
  // a senha e não deve ser tratada como um login comum.
  const retornoDeRecuperacao = recuperandoSenha
    || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'
  if (retornoDeRecuperacao) {
    return <Navigate to={{ pathname: '/redefinir-senha', hash: window.location.hash }} replace />
  }
  if (session) return <Navigate to="/app" replace />

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        await entrar(email.trim(), senha)
      } else if (modo === 'cadastrar') {
        const { precisaConfirmar } = await cadastrar({
          nome: nome.trim(),
          email: email.trim(),
          senha,
          empresa: empresa.trim() || undefined,
        })
        toast.sucesso(precisaConfirmar
          ? 'Conta criada. Confirme o e-mail para entrar.'
          : 'Conta criada com sucesso.')
        if (precisaConfirmar) setModo('entrar')
      } else {
        await recuperarSenha(email.trim())
        toast.sucesso('Enviamos um link de recuperação para seu e-mail.')
        setModo('entrar')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha inesperada.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <div className="login-aurora" aria-hidden>
        <Aurora colorStops={["#71d326", "#a58cf0", "#39758d"]} blend={0.6} amplitude={1} speed={0.55} />
      </div>
      <aside className="login-hero">
        <div className="login-hero-topo">
          <Link to="/" className="login-voltar"><ArrowLeft size={15} />Voltar ao site</Link>
        </div>
        <div className="login-hero-conteudo">
          <div className="login-brand">
            <div className="brand-mark lg">M</div>
            <div><b>Maintenex</b><small>Gestão de manutenção</small></div>
          </div>
          <div className="login-hero-meio">
            <h1>Manutenção sob controle,<br />do checklist ao estoque.</h1>
            <ul className="login-features">
              {destaques.map(([titulo, texto]) => (
                <li key={titulo}>
                  <ShieldCheck size={18} />
                  <div><strong>{titulo}</strong><span>{texto}</span></div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer>Autenticação segura via Supabase</footer>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <div className="login-tabs" role="tablist">
            {(['entrar', 'cadastrar'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={modo === m}
                className={modo === m ? 'ativo' : ''}
                onClick={() => { setModo(m); setErro(null) }}
              >
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <h2>
            {modo === 'entrar' && 'Bem-vindo de volta'}
            {modo === 'cadastrar' && 'Crie sua conta'}
            {modo === 'recuperar' && 'Recuperar acesso'}
          </h2>
          <p className="login-sub">
            {modo === 'recuperar'
              ? 'Informe o e-mail cadastrado e enviaremos um link de redefinição.'
              : 'Use seu e-mail corporativo para acessar o painel.'}
          </p>

          {!supabaseConfigurado && (
            <div className="alerta aviso">
              Supabase não configurado. Preencha <code>VITE_SUPABASE_URL</code> e{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> em <code>frontend/.env</code>.
            </div>
          )}

          <form onSubmit={enviar} className="login-form">
            {modo === 'cadastrar' && (
              <>
                <label className="campo">
                  <span>Nome</span>
                  <div className="campo-input">
                    <User size={17} />
                    <input value={nome} onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome" required autoComplete="name" />
                  </div>
                </label>

                <label className="campo">
                  <span>Empresa</span>
                  <div className="campo-input">
                    <Building2 size={17} />
                    <input value={empresa} onChange={(e) => setEmpresa(e.target.value)}
                      placeholder="Nome da sua empresa" autoComplete="organization" />
                  </div>
                  <small className="ajuda">
                    Informe a empresa para criá-la e virar o responsável principal.
                    Se você foi convidado por e-mail, deixe em branco.
                  </small>
                </label>
              </>
            )}

            <label className="campo">
              <span>E-mail</span>
              <div className="campo-input">
                <Mail size={17} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br" required autoComplete="email" />
              </div>
            </label>

            {modo !== 'recuperar' && (
              <label className="campo">
                <span>Senha</span>
                <div className="campo-input">
                  <Lock size={17} />
                  <input type={verSenha ? 'text' : 'password'} value={senha}
                    onChange={(e) => setSenha(e.target.value)} placeholder="••••••••"
                    required minLength={6}
                    autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
                  <button type="button" className="icone-btn" onClick={() => setVerSenha((v) => !v)}
                    aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                    {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            )}

            {erro && <div className="alerta erro">{erro}</div>}

            <button className="btn primario grande" disabled={enviando || !supabaseConfigurado}>
              {enviando ? <Loader2 size={17} className="girando" /> : <ArrowRight size={17} />}
              {modo === 'entrar' && 'Entrar'}
              {modo === 'cadastrar' && 'Criar conta'}
              {modo === 'recuperar' && 'Enviar link'}
            </button>
          </form>

          <div className="login-rodape">
            {modo === 'recuperar' ? (
              <button type="button" onClick={() => setModo('entrar')}>Voltar para o login</button>
            ) : (
              <button type="button" onClick={() => setModo('recuperar')}>Esqueci minha senha</button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
