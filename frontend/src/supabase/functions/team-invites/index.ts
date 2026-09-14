import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'

const DENO = globalThis.Deno
const _DenoTypeCheck: typeof Deno = DENO

type PapelUsuario = 'owner' | 'gestor' | 'tecnico' | 'leitor'
type InviteAction = 'send' | 'resend' | 'accept' | 'cancel'
type StatusEnvio = 'enviado' | 'dry_run' | 'falhou' | 'ja_membro' | 'aceito' | 'cancelado'

interface InviteRequest {
  action?: InviteAction
  email?: string
  papel?: PapelUsuario
  conviteId?: string
  token?: string
  empresaId?: string
}

interface PreparedInvite {
  status: 'preparado' | 'ja_membro'
  convite_id: string | null
  empresa_id: string
  email: string
  papel: PapelUsuario
  empresa_nome: string
  convidado_nome: string | null
}

interface InviteResponse {
  status: StatusEnvio
  mensagem: string
  conviteId?: string
  inviteUrl?: string
}

interface RpcError {
  message?: string
  code?: string
}

class ConviteError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const mensagensRpcPermitidas = new Set([
  'Usuário sem permissão para enviar convites.',
  'Somente responsáveis da empresa enviam convites.',
  'Convite não pode conceder o papel super_admin.',
  'Token de convite inválido.',
  'Convite não encontrado.',
  'Informe um e-mail válido.',
  'Selecione uma empresa ativa para enviar o convite.',
  'Você só convida para a sua própria empresa.',
  'Empresa inativa ou não encontrada.',
  'Este e-mail já pertence a outra empresa.',
  'Aguarde um minuto antes de reenviar este convite.',
  'Status de envio inválido.',
  'Link de convite inválido.',
  'Usuário autenticado não encontrado.',
  'Convite inválido, expirado ou já aceito.',
  'Este usuário já pertence a outra empresa.',
  'Somente responsáveis da empresa removem convites.',
  'Você só remove convites da sua própria empresa.',
  'Convites já aceitos não podem ser removidos.',
])

// Garante que o arquivo permaneça compatível com o runtime Deno da Edge Function.
void _DenoTypeCheck

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function erro(message: string, status = 400) {
  return json({ error: message }, status)
}

function env(name: string) {
  return DENO.env.get(name)?.trim() ?? ''
}

function siteUrl() {
  return (env('SITE_URL') || env('APP_SITE_URL') || 'http://localhost:5173').replace(/\/$/, '')
}

function normalizarEmail(email: unknown) {
  if (typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

function validarPapel(papel: unknown): PapelUsuario | null {
  if (papel === 'owner' || papel === 'gestor' || papel === 'tecnico' || papel === 'leitor') return papel
  return null
}

function tokenSeguro() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256Hex(valor: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function conviteUrl(token: string) {
  const url = new URL('/login', siteUrl())
  url.searchParams.set('modo', 'cadastrar')
  url.searchParams.set('convite', token)
  return url.toString()
}

function supabaseAdmin() {
  const url = env('SUPABASE_URL')
  const serviceRole = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRole) throw new ConviteError('Supabase server-side não configurado.', 500)
  return createClient(url, serviceRole, { auth: { persistSession: false } })
}

function supabaseAuthClient(req: Request) {
  const url = env('SUPABASE_URL')
  const anon = env('SUPABASE_ANON_KEY')
  const auth = req.headers.get('Authorization') ?? ''
  if (!url || !anon) throw new ConviteError('Supabase Auth server-side não configurado.', 500)
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  })
}

async function usuarioAutenticado(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) throw new Response('Não autenticado.', { status: 401 })
  const client = supabaseAuthClient(req)
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Response('Não autenticado.', { status: 401 })
  return data.user
}

function statusErroRpc(mensagem: string) {
  if (mensagem.startsWith('Aguarde')) return 429
  return mensagem.includes('permissão') || mensagem.includes('Somente') || mensagem.includes('sua própria empresa') ? 403 : 400
}

function erroRpc(error: RpcError) {
  const mensagem = error.message?.trim() ?? ''
  if (error.code === 'P0001' && mensagensRpcPermitidas.has(mensagem)) {
    return new ConviteError(mensagem, statusErroRpc(mensagem))
  }
  return new ConviteError('Falha ao processar convite.', 500)
}

async function chamarRpc<T>(admin: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args)
  if (error) throw erroRpc(error)
  return data as T
}

async function prepararConvite(admin: SupabaseClient, actorId: string, req: InviteRequest, token: string) {
  const tokenHash = await sha256Hex(token)
  const papel = validarPapel(req.papel ?? 'tecnico')
  if (!papel && req.action !== 'resend') throw new ConviteError('Papel de convite inválido.')
  const email = normalizarEmail(req.email)
  if (!req.conviteId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConviteError('Informe um e-mail válido.')

  const data = await chamarRpc<PreparedInvite[]>(admin, 'admin_preparar_convite_equipe', {
    p_actor_id: actorId,
    p_email: email,
    p_papel: papel ?? 'tecnico',
    p_token_hash: tokenHash,
    p_empresa_id: req.empresaId ?? null,
    p_convite_id: req.conviteId ?? null,
  })

  const convite = data?.[0]
  if (!convite) throw new ConviteError('Não foi possível preparar o convite.', 500)
  return convite
}

async function marcarEnvio(admin: SupabaseClient, conviteId: string, status: 'enviado' | 'dry_run' | 'falhou', sendId?: string, error?: string) {
  await chamarRpc<null>(admin, 'admin_marcar_envio_convite', {
    p_convite_id: conviteId,
    p_status: status,
    p_send_id: sendId ?? null,
    p_error: error ?? null,
  })
}

function erroEnvioSeguro(error: unknown) {
  if (error instanceof ConviteError && error.message.includes('Configuração')) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return 'Tempo limite no envio do convite.'
  return 'Falha no envio do convite.'
}

async function enviarResend(params: { to: string; empresa: string; papel: string; inviteUrl: string }) {
  const apiKey = env('RESEND_API_KEY')
  const from = env('INVITES_FROM')
  const dryRun = env('INVITES_DRY_RUN').toLowerCase() === 'true'
  if (dryRun) return { status: 'dry_run' as const, id: 'dry-run' }
  if (!apiKey || !from) throw new ConviteError('Configuração de envio de convites incompleta.', 500)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `Convite para acessar ${params.empresa} no Maintenex`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#152033">
            <h1>Você foi convidado para o Maintenex</h1>
            <p>Você recebeu um convite para acessar a equipe <strong>${escapeHtml(params.empresa)}</strong> com papel <strong>${escapeHtml(params.papel)}</strong>.</p>
            <p><a href="${escapeHtml(params.inviteUrl)}" style="display:inline-block;background:#39758d;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Aceitar convite</a></p>
            <p>Se você não esperava este convite, ignore este e-mail.</p>
          </div>
        `,
        text: `Você foi convidado para acessar ${params.empresa} no Maintenex. Aceite em: ${params.inviteUrl}`,
      }),
    })

    const body = await resposta.text()
    if (!resposta.ok) throw new Error('Falha no envio pelo Resend.')
    const parsed = body ? JSON.parse(body) as { id?: string } : {}
    return { status: 'enviado' as const, id: parsed.id }
  } finally {
    clearTimeout(timeout)
  }
}

function escapeHtml(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function sendOrResend(req: Request, body: InviteRequest): Promise<Response> {
  const user = await usuarioAutenticado(req)
  const admin = supabaseAdmin()
  const token = tokenSeguro()
  const prepared = await prepararConvite(admin, user.id, body, token)

  if (prepared.status === 'ja_membro') {
    return json({ status: 'ja_membro', mensagem: 'Este usuário já faz parte da equipe.' } satisfies InviteResponse)
  }

  const url = conviteUrl(token)
  let envioStatus: 'enviado' | 'dry_run' | 'falhou' = 'falhou'
  let envioId: string | undefined
  try {
    const result = await enviarResend({
      to: prepared.email,
      empresa: prepared.empresa_nome,
      papel: prepared.papel,
      inviteUrl: url,
    })
    envioStatus = result.status
    envioId = result.id
    await marcarEnvio(admin, prepared.convite_id!, envioStatus, envioId)
  } catch (error) {
    await marcarEnvio(admin, prepared.convite_id!, 'falhou', undefined, erroEnvioSeguro(error))
    return json({
      status: 'falhou',
      mensagem: 'Convite registrado, mas não foi possível enviar o e-mail.',
      conviteId: prepared.convite_id!,
      inviteUrl: env('INVITES_DRY_RUN').toLowerCase() === 'true' ? url : undefined,
    } satisfies InviteResponse)
  }

  return json({
    status: envioStatus,
    mensagem: envioStatus === 'dry_run' ? 'Convite gerado em modo teste. Nenhum e-mail real foi enviado.' : 'Convite enviado com sucesso.',
    conviteId: prepared.convite_id!,
    inviteUrl: envioStatus === 'dry_run' ? url : undefined,
  } satisfies InviteResponse)
}

async function accept(req: Request, body: InviteRequest): Promise<Response> {
  const user = await usuarioAutenticado(req)
  if (!body.token) return erro('Link de convite inválido.')
  const admin = supabaseAdmin()
  await chamarRpc<unknown>(admin, 'admin_aceitar_convite_equipe', {
    p_user_id: user.id,
    p_token: body.token,
  })
  return json({ status: 'aceito', mensagem: 'Convite aceito. Você já pode acessar a equipe.' } satisfies InviteResponse)
}

async function cancel(req: Request, body: InviteRequest): Promise<Response> {
  const user = await usuarioAutenticado(req)
  if (!body.conviteId) return erro('Convite não informado.')
  const admin = supabaseAdmin()
  await chamarRpc<null>(admin, 'admin_cancelar_convite_equipe', {
    p_actor_id: user.id,
    p_convite_id: body.conviteId,
  })
  return json({ status: 'cancelado', mensagem: 'Convite removido.' } satisfies InviteResponse)
}

DENO.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return erro('Método não permitido.', 405)

  let body: InviteRequest
  try {
    body = await req.json()
  } catch {
    return erro('Requisição inválida.')
  }

  try {
    const action = body.action ?? 'send'
    if (action === 'send' || action === 'resend') return await sendOrResend(req, { ...body, action })
    if (action === 'accept') return await accept(req, body)
    if (action === 'cancel') return await cancel(req, body)
    return erro('Ação de convite inválida.')
  } catch (error) {
    if (error instanceof Response) {
      return json({ error: await error.text() }, error.status)
    }
    if (error instanceof ConviteError) return erro(error.message, error.status)
    return erro('Falha ao processar convite.', 500)
  }
})
