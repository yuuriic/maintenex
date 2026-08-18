import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && anonKey)

/**
 * Quando as variáveis não existem o client é criado com valores inertes:
 * o app sobe e mostra a tela de configuração em vez de quebrar no import.
 */
export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'anon-key-ausente',
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'maintenex.auth' } },
)
