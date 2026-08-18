import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { supabase, supabaseConfigurado } from './supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Cidade, PapelUsuario, Setor } from './types'

type Tema = 'claro' | 'escuro'

interface AppState {
  /** Empresa do usuário logado — obrigatória em todo insert (RLS filtra por ela). */
  empresaId: string | null
  papel: PapelUsuario | null
  ehSuperAdmin: boolean
  podeAdministrar: boolean
  tema: Tema
  alternarTema: () => void
  cidades: Cidade[]
  setores: Setor[]
  cidadeId: string | null
  setorId: string | null
  setCidadeId: (id: string | null) => void
  setSetorId: (id: string | null) => void
  cidadeAtual: Cidade | null
  recarregarEscopo: () => Promise<void>
}

const AppStateContext = createContext<AppState | null>(null)
const CHAVE_TEMA = 'maintenex.tema'
const CHAVE_CIDADE = 'maintenex.cidade'

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [tema, setTema] = useState<Tema>(
    () => (localStorage.getItem(CHAVE_TEMA) as Tema | null)
      ?? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro'),
  )
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [cidadeId, setCidadeIdEstado] = useState<string | null>(() => localStorage.getItem(CHAVE_CIDADE))
  const [setorId, setSetorId] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    localStorage.setItem(CHAVE_TEMA, tema)
  }, [tema])

  const carregar = useCallback(async () => {
    if (!supabaseConfigurado || !profile) return
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('cidades').select('*').order('nome'),
      supabase.from('setores').select('*').order('nome'),
    ])
    const listaCidades = (c ?? []) as Cidade[]
    setCidades(listaCidades)
    setSetores((s ?? []) as Setor[])
    setCidadeIdEstado((atual) => {
      if (atual && listaCidades.some((x) => x.id === atual)) return atual
      return listaCidades[0]?.id ?? null
    })
  }, [profile])

  useEffect(() => { void carregar() }, [carregar])

  const setCidadeId = useCallback((id: string | null) => {
    setCidadeIdEstado(id)
    setSetorId(null)
    if (id) localStorage.setItem(CHAVE_CIDADE, id)
    else localStorage.removeItem(CHAVE_CIDADE)
  }, [])

  const valor = useMemo<AppState>(() => ({
    empresaId: profile?.empresa_id ?? null,
    papel: profile?.papel ?? null,
    ehSuperAdmin: profile?.papel === 'super_admin',
    podeAdministrar: profile?.papel === 'super_admin' || profile?.papel === 'owner',
    tema,
    alternarTema: () => setTema((t) => (t === 'escuro' ? 'claro' : 'escuro')),
    cidades,
    setores: setores.filter((s) => !cidadeId || s.cidade_id === cidadeId),
    cidadeId,
    setorId,
    setCidadeId,
    setSetorId,
    cidadeAtual: cidades.find((c) => c.id === cidadeId) ?? null,
    recarregarEscopo: carregar,
  }), [profile, tema, cidades, setores, cidadeId, setorId, setCidadeId, carregar])

  return <AppStateContext.Provider value={valor}>{children}</AppStateContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppStateProvider>')
  return ctx
}
