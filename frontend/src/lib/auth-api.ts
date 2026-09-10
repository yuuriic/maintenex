import { traduzErroAuth } from './auth-errors'

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = 15_000

export const authApiConfigurada = Boolean(apiUrl)

export async function chamarAuth<T>(caminho: string, corpo: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let resposta: Response
  try {
    resposta = await fetch(`${apiUrl}/api/auth/${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Serviço de autenticação indisponível ou lento demais. Tente novamente.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
  const texto = await resposta.text()
  if (!resposta.ok) {
    let mensagem = texto || 'Falha na autenticação.'
    try {
      const json = JSON.parse(texto)
      mensagem = json.msg ?? json.message ?? json.error_description ?? mensagem
    } catch { /* resposta sem JSON */ }
    throw new Error(traduzErroAuth(mensagem))
  }
  return (texto ? JSON.parse(texto) : undefined) as T
}
