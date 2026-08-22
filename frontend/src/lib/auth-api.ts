import { traduzErroAuth } from './auth-errors'

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const authApiConfigurada = Boolean(apiUrl)

export async function chamarAuth<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${apiUrl}/api/auth/${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
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

