import { useCallback, useEffect, useState } from 'react'

/**
 * Executa uma consulta assíncrona e expõe dados/carregando/erro + recarregar().
 * `deps` controla quando a consulta roda de novo.
 */
export function useConsulta<T>(consulta: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(consulta, deps)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await executar())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar dados.')
    } finally {
      setCarregando(false)
    }
  }, [executar])

  useEffect(() => { void recarregar() }, [recarregar])

  return { dados, setDados, carregando, erro, recarregar }
}
