import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { authApiConfigurada, chamarAuth } from '../lib/auth-api'
import { traduzErroAuth } from '../lib/auth-errors'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  carregando: boolean
  recuperandoSenha: boolean
  entrar: (email: string, senha: string) => Promise<void>
  cadastrar: (dados: DadosCadastro) => Promise<{ precisaConfirmar: boolean }>
  confirmarCadastro: (email: string, codigo: string) => Promise<void>
  reenviarCodigoCadastro: (email: string) => Promise<void>
  recuperarSenha: (email: string) => Promise<void>
  sair: () => Promise<void>
  atualizarPerfil: (dados: Partial<Profile>) => Promise<void>
}

export interface DadosCadastro {
  nome: string
  email: string
  senha: string
  telefone: string
  /** Preenchido no auto-cadastro: o primeiro usuário vira owner da empresa criada. */
  empresa?: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)

  useEffect(() => {
    if (!supabaseConfigurado) { setCarregando(false); return }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      if (evento === 'SIGNED_OUT') setRecuperandoSenha(false)
      setSession(novaSessao)
      setCarregando(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const id = session?.user?.id
    if (!id) { setProfile(null); return }

    let ativo = true
    supabase.from('profiles').select('*, empresas(id, nome, slug, status)').eq('id', id).maybeSingle().then(({ data }) => {
      if (!ativo) return
      setProfile(
        (data as Profile | null) ?? {
          id,
          nome: session!.user.user_metadata?.nome ?? session!.user.email?.split('@')[0] ?? 'Usuário',
          email: session!.user.email ?? '',
          telefone: session!.user.user_metadata?.telefone ?? null,
          email_verificado: Boolean(session!.user.email_confirmed_at),
          papel: 'leitor',
          empresa_id: null,
          cidade_id: null,
          avatar_url: null,
          ativo: true,
          criado_em: new Date().toISOString(),
        },
      )
    })
    return () => { ativo = false }
  }, [session])

  const valor = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    carregando,
    recuperandoSenha,

    async entrar(email, senha) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw new Error(traduzErroAuth(error.message))
    },

    async cadastrar({ nome, email, senha, telefone, empresa }) {
      if (authApiConfigurada) {
        const data = await chamarAuth<{ access_token?: string }>('signup', { nome, email, telefone, senha, empresa })
        return { precisaConfirmar: !data.access_token }
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome, telefone, ...(empresa ? { empresa_nome: empresa } : {}) } },
      })
      if (error) throw new Error(traduzErroAuth(error.message))
      if (data.user?.identities?.length === 0) {
        throw new Error('Este e-mail já está cadastrado.')
      }
      return { precisaConfirmar: !data.session }
    },

    async confirmarCadastro(email, codigo) {
      if (authApiConfigurada) {
        const data = await chamarAuth<{ access_token: string; refresh_token: string }>('verify', { email, codigo })
        const { error } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
        if (error) throw new Error(traduzErroAuth(error.message))
        return
      }
      const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'signup' })
      if (error) throw new Error(traduzErroAuth(error.message))
    },

    async reenviarCodigoCadastro(email) {
      if (authApiConfigurada) {
        await chamarAuth<void>('resend', { email })
        return
      }
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw new Error(traduzErroAuth(error.message))
    },

    async recuperarSenha(email) {
      const siteUrl = (import.meta.env.VITE_SITE_URL ?? window.location.origin).replace(/\/$/, '')
      if (authApiConfigurada) {
        await chamarAuth<void>('recover', { email })
        return
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/redefinir-senha`,
      })
      if (error) throw new Error(traduzErroAuth(error.message))
    },

    async sair() {
      await supabase.auth.signOut()
      setRecuperandoSenha(false)
      setProfile(null)
    },

    async atualizarPerfil(dados) {
      if (!session?.user?.id) return
      const { data, error } = await supabase
        .from('profiles').update(dados).eq('id', session.user.id).select().single()
      if (error) throw new Error(error.message)
      setProfile(data as Profile)
    },
  }), [session, profile, carregando, recuperandoSenha])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
