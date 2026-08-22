import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react'
import { aplicarSeo } from '../lib/seo'
import { useAuth } from './AuthProvider'
import { supabaseConfigurado } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Aurora from '../components/ui/aurora'
import PasswordStrength, { senhaAtendeRequisitos } from '../components/ui/password-strength'
import OtpInput from '../components/ui/otp-input'
import BrandMark from '../components/ui/brand-mark'
import { traduzErroAuth } from '../lib/auth-errors'

type Modo = 'entrar' | 'cadastrar' | 'confirmar' | 'recuperar'
type ErrosCampos = Partial<Record<'nome' | 'email' | 'telefone' | 'senha' | 'confirmacao' | 'codigo', string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const OTP_LENGTH = Math.min(8, Math.max(6, Number(import.meta.env.VITE_EMAIL_OTP_LENGTH) || 8))

function normalizarTelefone(valor: string) {
  const temMais = valor.trim().startsWith('+')
  const digitos = valor.replace(/\D/g, '')
  if (temMais && digitos.length >= 10 && digitos.length <= 15) return `+${digitos}`
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`
  return null
}

function mascararEmail(valor: string) {
  const [usuario, dominio] = valor.trim().split('@')
  if (!usuario || !dominio) return 'seu e-mail'
  const inicio = usuario.slice(0, Math.min(2, usuario.length))
  return `${inicio}${'•'.repeat(Math.max(3, usuario.length - inicio.length))}@${dominio}`
}

const destaques = [
  ['Checklists preventivos', 'Rotinas por equipamento com histórico completo.'],
  ['Estoque em tempo real', 'Movimentações que atualizam o saldo na hora.'],
  ['Pendências com SLA', 'Prioridade, responsável e tempo de resposta.'],
]

export default function LoginPage() {
  const { session, recuperandoSenha, entrar, cadastrar, confirmarCadastro, reenviarCodigoCadastro, recuperarSenha } = useAuth()
  const toast = useToast()
  const [params] = useSearchParams()
  const [modo, setModo] = useState<Modo>(params.get('modo') === 'cadastrar' ? 'cadastrar' : 'entrar')
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [errosCampos, setErrosCampos] = useState<ErrosCampos>({})
  const [reenvios, setReenvios] = useState(0)
  const [proximoReenvio, setProximoReenvio] = useState(0)
  const [agora, setAgora] = useState(Date.now())

  useEffect(() => {
    if (proximoReenvio <= Date.now()) return
    const timer = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [proximoReenvio])

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

  async function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    const novosErros: ErrosCampos = {}
    if (!EMAIL_RE.test(email.trim())) novosErros.email = 'Informe um e-mail válido.'
    if (modo === 'cadastrar') {
      if (!nome.trim()) novosErros.nome = 'Informe seu nome.'
      if (!telefone.trim()) novosErros.telefone = 'Informe seu telefone.'
      else if (!normalizarTelefone(telefone)) novosErros.telefone = 'Use DDD + número ou formato internacional com +.'
      if (!senhaAtendeRequisitos(senha)) novosErros.senha = 'Atenda a todos os requisitos da senha.'
      if (senha !== confirmacaoSenha) novosErros.confirmacao = 'As senhas não coincidem.'
    }
    if (modo === 'confirmar' && !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(codigo)) {
      novosErros.codigo = `Informe os ${OTP_LENGTH} dígitos do código.`
    }
    setErrosCampos(novosErros)
    if (Object.keys(novosErros).length) return
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        await entrar(email.trim(), senha)
      } else if (modo === 'cadastrar') {
        const { precisaConfirmar } = await cadastrar({
          nome: nome.trim(),
          email: email.trim(),
          senha,
          telefone: normalizarTelefone(telefone)!,
          empresa: empresa.trim() || undefined,
        })
        if (precisaConfirmar) {
          toast.sucesso('Enviamos um código de confirmação para seu e-mail.')
          setModo('confirmar')
          setProximoReenvio(Date.now() + 60_000)
        } else toast.sucesso('Conta criada com sucesso.')
      } else if (modo === 'confirmar') {
        await confirmarCadastro(email.trim(), codigo)
        toast.sucesso('E-mail confirmado. Sua conta está ativa.')
      } else {
        await recuperarSenha(email.trim())
        toast.sucesso('Enviamos um link de recuperação para seu e-mail.')
        setModo('entrar')
      }
    } catch (e) {
      setErro(traduzErroAuth(e instanceof Error ? e.message : null))
    } finally {
      setEnviando(false)
    }
  }

  async function reenviarCodigo() {
    if (reenvios >= 3 || proximoReenvio > Date.now()) return
    setErro(null)
    setEnviando(true)
    try {
      await reenviarCodigoCadastro(email.trim())
      setReenvios((valor) => valor + 1)
      setProximoReenvio(Date.now() + 60_000)
      setAgora(Date.now())
      toast.sucesso('Novo código enviado.')
    } catch (e) {
      setErro(traduzErroAuth(e instanceof Error ? e.message : null))
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
            <BrandMark size="lg" />
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
          {modo !== 'confirmar' && <div className="login-tabs" role="tablist">
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
          </div>}

          <h2>
            {modo === 'entrar' && 'Bem-vindo de volta'}
            {modo === 'cadastrar' && 'Crie sua conta'}
            {modo === 'confirmar' && 'Confirme seu e-mail'}
            {modo === 'recuperar' && 'Recuperar acesso'}
          </h2>
          <p className="login-sub">
            {modo === 'confirmar'
              ? `Digite o código enviado para ${mascararEmail(email)}.`
              : modo === 'recuperar'
              ? 'Informe o e-mail cadastrado e enviaremos um link de redefinição.'
              : 'Use seu e-mail corporativo para acessar o painel.'}
          </p>

          {!supabaseConfigurado && (
            <div className="alerta aviso">
              Autenticação temporariamente indisponível. Revise a configuração do ambiente antes de continuar.
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
                  {errosCampos.nome && <small className="campo-erro">{errosCampos.nome}</small>}
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
              {errosCampos.email && <small className="campo-erro">{errosCampos.email}</small>}
            </label>

            {modo === 'cadastrar' && (
              <label className="campo">
                <span>Telefone</span>
                <div className="campo-input">
                  <Phone size={17} />
                  <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 99999-9999" required autoComplete="tel" />
                </div>
                {errosCampos.telefone && <small className="campo-erro">{errosCampos.telefone}</small>}
              </label>
            )}

            {modo === 'entrar' && (
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
                {errosCampos.senha && <small className="campo-erro">{errosCampos.senha}</small>}
              </label>
            )}

            {modo === 'cadastrar' && (
              <PasswordStrength id="senha-cadastro" label="Senha" password={senha}
                onChange={setSenha} visible={verSenha} onToggleVisible={() => setVerSenha((v) => !v)}
                erro={errosCampos.senha} />
            )}

            {modo === 'cadastrar' && (
              <label className="campo">
                <span>Confirmar senha</span>
                <div className="campo-input">
                  <Lock size={17} />
                  <input type={verSenha ? 'text' : 'password'} value={confirmacaoSenha}
                    onChange={(e) => setConfirmacaoSenha(e.target.value)} required minLength={8}
                    autoComplete="new-password" />
                </div>
                {errosCampos.confirmacao && <small className="campo-erro">{errosCampos.confirmacao}</small>}
              </label>
            )}

            {modo === 'confirmar' && (
              <OtpInput length={OTP_LENGTH} value={codigo} disabled={enviando} autoFocus
                status={erro || errosCampos.codigo ? 'error' : 'idle'}
                message={errosCampos.codigo ?? erro ?? `Código de ${OTP_LENGTH} dígitos`}
                onChange={(valor) => {
                  setCodigo(valor)
                  setErro(null)
                  setErrosCampos((atuais) => ({ ...atuais, codigo: undefined }))
                }} />
            )}

            {erro && modo !== 'confirmar' && <div className="alerta erro">{erro}</div>}

            <button className="btn primario grande"
              disabled={enviando || !supabaseConfigurado || (modo === 'confirmar' && codigo.length !== OTP_LENGTH)}>
              {enviando ? <Loader2 size={17} className="girando" /> : <ArrowRight size={17} />}
              {modo === 'entrar' && 'Entrar'}
              {modo === 'cadastrar' && 'Criar conta'}
              {modo === 'confirmar' && 'Confirmar conta'}
              {modo === 'recuperar' && 'Enviar link'}
            </button>
          </form>

          <div className="login-rodape">
            {modo === 'confirmar' ? (
              <>
                <button type="button" onClick={reenviarCodigo}
                  disabled={enviando || reenvios >= 3 || proximoReenvio > agora}>
                  {reenvios >= 3
                    ? 'Limite de reenvios atingido'
                    : proximoReenvio > agora
                      ? `Reenviar em ${Math.ceil((proximoReenvio - agora) / 1000)}s`
                      : 'Reenviar código'}
                </button>
                <button type="button" onClick={() => setModo('cadastrar')}>Corrigir meus dados</button>
              </>
            ) : modo === 'recuperar' ? (
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
