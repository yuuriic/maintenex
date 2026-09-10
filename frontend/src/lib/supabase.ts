import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const REQUEST_TIMEOUT_MS = 15_000

/** Evita spinner infinito quando o projeto Supabase está pausado ou saturado. */
const fetchComTimeout: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const sinalExterno = init.signal
  const abortar = () => controller.abort()

  if (sinalExterno) {
    if (sinalExterno.aborted) controller.abort()
    else sinalExterno.addEventListener('abort', abortar, { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted && !sinalExterno?.aborted) {
      throw new Error('Supabase indisponível ou lento demais. Tente novamente.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
    sinalExterno?.removeEventListener('abort', abortar)
  }
}

export const supabaseConfigurado = Boolean(url && anonKey)

/**
 * Quando as variáveis não existem o client é criado com valores inertes:
 * o app sobe e mostra a tela de configuração em vez de quebrar no import.
 */
export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'anon-key-ausente',
  {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'maintenex.auth' },
    global: { fetch: fetchComTimeout },
  },
)
