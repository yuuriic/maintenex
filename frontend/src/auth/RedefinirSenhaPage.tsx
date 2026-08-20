import { useEffect, useState, type SubmitEvent } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { aplicarSeo } from '../lib/seo'
import Aurora from '../components/ui/aurora'
import PasswordStrength, { senhaAtendeRequisitos } from '../components/ui/password-strength'

const destaques = [
  ['Senha protegida', 'Use uma combinação única e difícil de adivinhar.'],
  ['Sessão segura', 'O link de recuperação é temporário e de uso único.'],
  ['Acesso preservado', 'Após a troca, entre novamente com a nova senha.'],
]

export default function RedefinirSenhaPage() {
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    aplicarSeo({
      titulo: 'Redefinir senha | Maintenex',
      descricao: 'Defina uma nova senha para sua conta Maintenex.',
      caminho: '/redefinir-senha',
      noindex: true,
    })

    const parametros = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`)
    const erroLink = parametros.get('error_description')
    if (erroLink) {
      setErro(erroLink.includes('expired')
        ? 'Este link expirou ou já foi utilizado. Solicite um novo link de recuperação.'
        : erroLink.replaceAll('+', ' '))
    }
  }, [])

  async function salvar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)

    if (!senhaAtendeRequisitos(senha)) {
      setErro('Atenda a todos os requisitos da senha.')
      return
    }

    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.')
      return
    }

    setEnviando(true)
    const { data: sessao } = await supabase.auth.getSession()
    if (!sessao.session) {
      setErro('O link é inválido ou expirou. Solicite um novo link de recuperação.')
      setEnviando(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErro(error.message)
      setEnviando(false)
      return
    }

    await supabase.auth.signOut()
    navigate('/login?senha=alterada', { replace: true })
  }

  async function voltarAoLogin() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="login pagina-redefinir">
      <div className="login-aurora" aria-hidden>
        <Aurora colorStops={["#71d326", "#a58cf0", "#39758d"]} blend={0.6} amplitude={1} speed={0.55} />
      </div>
      <aside className="login-hero">
        <div className="login-hero-topo">
          <Link to="/login" className="login-voltar"><ArrowLeft size={15} />Voltar ao login</Link>
        </div>
        <div className="login-hero-conteudo">
          <div className="login-brand">
            <div className="brand-mark lg">M</div>
            <div><b>Maintenex</b><small>Gestão de manutenção</small></div>
          </div>
          <div className="login-hero-meio">
            <h1>Recupere seu acesso<br />com segurança.</h1>
            <ul className="login-features">
              {destaques.map(([titulo, texto]) => (
                <li key={titulo}><ShieldCheck size={18} /><div><strong>{titulo}</strong><span>{texto}</span></div></li>
              ))}
            </ul>
          </div>
        </div>
        <footer>Autenticação segura via Supabase</footer>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <h2>Defina uma nova senha</h2>
          <p className="login-sub">Crie uma senha forte para proteger sua conta.</p>

          <form onSubmit={salvar} className="login-form">
            <PasswordStrength id="nova-senha" label="Nova senha" password={senha}
              onChange={setSenha} visible={verSenha} onToggleVisible={() => setVerSenha((valor) => !valor)}
              erro={erro === 'Atenda a todos os requisitos da senha.' ? erro : undefined} autoFocus />

            <label className="campo">
              <span>Confirmar nova senha</span>
              <div className="campo-input">
                <Lock size={17} />
                <input type={verSenha ? 'text' : 'password'} value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)} required minLength={8}
                  autoComplete="new-password" />
              </div>
            </label>

            {erro && erro !== 'Atenda a todos os requisitos da senha.' && <div className="alerta erro">{erro}</div>}

            <button className="btn primario grande"
              disabled={enviando || Boolean(erro?.includes('link')) || !senhaAtendeRequisitos(senha) || senha !== confirmacao}>
              {enviando ? <Loader2 size={17} className="girando" /> : <ArrowRight size={17} />}
              Salvar nova senha
            </button>
          </form>

          <div className="login-rodape">
            <button type="button" onClick={voltarAoLogin}>Voltar para o login</button>
          </div>
        </div>
      </main>
    </div>
  )
}
