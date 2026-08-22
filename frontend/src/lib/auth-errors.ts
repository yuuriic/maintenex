const ERRO_GENERICO = 'Não foi possível concluir a autenticação. Verifique os dados e tente novamente.'

const mensagensSeguras = new Set([
  'E-mail ou senha incorretos.',
  'Confirme seu e-mail antes de entrar.',
  'Este e-mail já está cadastrado.',
  'A senha precisa ter ao menos 6 caracteres.',
  'Formato de e-mail inválido.',
  'O código é inválido ou expirou.',
  'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
  'Muitas tentativas. Aguarde alguns minutos antes de reenviar.',
  'Aguarde antes de solicitar um novo código.',
  'O link é inválido ou expirou. Solicite um novo link de recuperação.',
])

export function traduzErroAuth(mensagem?: string | null) {
  if (!mensagem) return ERRO_GENERICO

  const texto = mensagem.trim()
  if (mensagensSeguras.has(texto)) return texto

  const textoNormalizado = texto.toLowerCase()
  if (texto.startsWith('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (texto.startsWith('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (texto.startsWith('User already registered')) return 'Este e-mail já está cadastrado.'
  if (texto.startsWith('Password should be at least 6 characters')) return 'A senha precisa ter ao menos 6 caracteres.'
  if (texto.startsWith('Unable to validate email address: invalid format')) return 'Formato de e-mail inválido.'
  if (texto.startsWith('Token has expired or is invalid')) return 'O código é inválido ou expirou.'
  if (texto.startsWith('Email rate limit exceeded')) return 'Muitas tentativas. Aguarde alguns minutos antes de reenviar.'
  if (texto.startsWith('For security purposes, you can only request this after')) return 'Aguarde antes de solicitar um novo código.'
  if (textoNormalizado.includes('expired') || textoNormalizado.includes('invalid token')) {
    return 'O link é inválido ou expirou. Solicite um novo link de recuperação.'
  }
  if (textoNormalizado.includes('rate limit') || textoNormalizado.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
  }

  return ERRO_GENERICO
}
