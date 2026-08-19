import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { aplicarSeo } from '../lib/seo'

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

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

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
    <main className="login-panel pagina-redefinir">
      <div className="login-card">
        <h2>Defina uma nova senha</h2>
        <p className="login-sub">Use pelo menos 6 caracteres e guarde sua nova senha em segurança.</p>

        <form onSubmit={salvar} className="login-form">
          <label className="campo">
            <span>Nova senha</span>
            <div className="campo-input">
              <Lock size={17} />
              <input type={verSenha ? 'text' : 'password'} value={senha}
                onChange={(e) => setSenha(e.target.value)} required minLength={6}
                autoComplete="new-password" />
              <button type="button" className="icone-btn" onClick={() => setVerSenha((valor) => !valor)}
                aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <label className="campo">
            <span>Confirmar nova senha</span>
            <div className="campo-input">
              <Lock size={17} />
              <input type={verSenha ? 'text' : 'password'} value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)} required minLength={6}
                autoComplete="new-password" />
            </div>
          </label>

          {erro && <div className="alerta erro">{erro}</div>}

          <button className="btn primario grande" disabled={enviando || Boolean(erro?.includes('link'))}>
            {enviando ? <Loader2 size={17} className="girando" /> : <ArrowRight size={17} />}
            Salvar nova senha
          </button>
        </form>

        <div className="login-rodape">
          <button type="button" onClick={voltarAoLogin}>Voltar para o login</button>
        </div>
      </div>
    </main>
  )
}
