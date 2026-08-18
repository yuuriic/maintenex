import { Link, Navigate, useLocation } from 'react-router-dom'
import { Building2, Loader2, LogOut } from 'lucide-react'
import { useAuth } from './AuthProvider'

export default function RotaProtegida({ children }: { children: React.ReactNode }) {
  const { session, profile, carregando, sair } = useAuth()
  const local = useLocation()

  if (carregando) {
    return <div className="tela-carregando"><Loader2 size={26} className="girando" /><span>Carregando sessão…</span></div>
  }

  if (!session) return <Navigate to="/login" replace state={{ de: local.pathname }} />

  // Perfil ainda não sincronizado (o trigger roda logo após o signUp)
  if (!profile) {
    return <div className="tela-carregando"><Loader2 size={26} className="girando" /><span>Preparando seu acesso…</span></div>
  }

  // Conta sem empresa: não veio por convite nem informou empresa no cadastro
  if (!profile.empresa_id && profile.papel !== 'super_admin') {
    return (
      <div className="tela-carregando">
        <Building2 size={30} />
        <h1>Conta sem empresa vinculada</h1>
        <p className="sem-empresa">
          Seu usuário <b>{profile.email}</b> ainda não pertence a nenhuma empresa.
          Peça ao responsável para enviar um convite para este e-mail, ou crie uma
          conta nova informando o nome da empresa.
        </p>
        <div className="acoes-topo">
          <Link className="btn" to="/">Voltar ao site</Link>
          <button className="btn primario" onClick={() => void sair()}><LogOut size={16} />Sair</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
