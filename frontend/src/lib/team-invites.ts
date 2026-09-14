import { supabase } from './supabase'
import type { PapelUsuario } from './types'

type PapelConvite = Exclude<PapelUsuario, 'super_admin'>

export type StatusRespostaConvite = 'enviado' | 'dry_run' | 'falhou' | 'ja_membro' | 'aceito' | 'cancelado'

export interface RespostaConviteEquipe {
  status: StatusRespostaConvite
  mensagem: string
  conviteId?: string
  inviteUrl?: string
}

interface ConviteFunctionError {
  message?: string
  context?: unknown
}

async function mensagemErro(error: ConviteFunctionError | Error | null | undefined) {
  const fallback = 'Falha ao processar convite.'
  if (!error) return fallback
  if ('context' in error && error.context instanceof Response) {
    const texto = await error.context.text()
    try {
      const json = JSON.parse(texto) as { error?: string; message?: string; mensagem?: string }
      return json.error ?? json.message ?? json.mensagem ?? fallback
    } catch {
      return texto || fallback
    }
  }
  const message = error.message?.trim()
  return message || fallback
}

async function chamarConvites(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<RespostaConviteEquipe>('team-invites', { body: corpo })
  if (error) throw new Error(await mensagemErro(error))
  if (!data) throw new Error('Resposta de convite vazia.')
  return data
}

export function enviarConviteEquipe(dados: { email: string; papel: PapelConvite; empresaId?: string | null }) {
  return chamarConvites({
    action: 'send',
    email: dados.email,
    papel: dados.papel,
    empresaId: dados.empresaId ?? null,
  })
}

export function reenviarConviteEquipe(conviteId: string) {
  return chamarConvites({ action: 'resend', conviteId })
}

export function aceitarConviteEquipe(token: string) {
  return chamarConvites({ action: 'accept', token })
}

export function cancelarConviteEquipe(conviteId: string) {
  return chamarConvites({ action: 'cancel', conviteId })
}

export function conviteTemLinkSeguro(resposta: RespostaConviteEquipe): resposta is RespostaConviteEquipe & { inviteUrl: string } {
  return typeof resposta.inviteUrl === 'string' && resposta.inviteUrl.length > 0
}
