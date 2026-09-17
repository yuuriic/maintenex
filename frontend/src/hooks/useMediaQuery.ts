import { useEffect, useState } from 'react'

/** Breakpoint único do shell autenticado: até aqui é mobile (bottom nav), acima é desktop (sidebar). */
export const QUERY_MOBILE = '(max-width: 760px)'

/** Lê o matchMedia de forma síncrona no primeiro render para não piscar o layout errado. */
export function useMediaQuery(query: string) {
  const [casa, setCasa] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const atualizar = (e: MediaQueryListEvent) => setCasa(e.matches)
    setCasa(mq.matches)
    mq.addEventListener('change', atualizar)
    return () => mq.removeEventListener('change', atualizar)
  }, [query])

  return casa
}
