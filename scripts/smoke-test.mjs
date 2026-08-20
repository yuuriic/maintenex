/**
 * Smoke test do Maintenex contra o Supabase real.
 *
 * Cria contas descartáveis via sub-endereçamento (+qa) do EMAIL_BASE.
 * Remova-as pelo painel (Authentication → Users) quando terminar.
 *
 *   EMAIL_BASE=seu-email@dominio.com.br node scripts/smoke-test.mjs
 *
 * Lê frontend/.env. Cria duas empresas de teste com usuários próprios e valida:
 *   1. auto-cadastro cria empresa + owner
 *   2. CRUD de cadastro e operação
 *   3. isolamento entre empresas (RLS)
 *   4. bloqueio de auto-escalação de papel
 *   5. convite não pode conceder super_admin
 *
 * Requer "Confirm email" DESLIGADO em Auth → Providers → Email
 * (senão o signUp não devolve sessão e o teste não consegue autenticar).
 */
import { readFileSync } from 'node:fs'
import { createClient } from '../frontend/node_modules/@supabase/supabase-js/dist/index.mjs'
 
const env = Object.fromEntries(
  readFileSync(new URL('../frontend/.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const URL_SB = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!URL_SB || !KEY) { console.error('faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(1) }

/**
 * O Supabase valida o domínio do e-mail (exige registro MX), então as contas de
 * teste usam sub-endereçamento de um endereço real:
 * EMAIL_BASE=voce@dominio.com.br vira voce+qa-a-<carimbo>@dominio.com.br.
 * O dominio precisa ter registro MX, senao o Supabase recusa o cadastro.
 */
const EMAIL_BASE = process.env.EMAIL_BASE
if (!EMAIL_BASE || !EMAIL_BASE.includes('@')) {
  console.error('defina EMAIL_BASE=seu-email@dominio.com.br antes de rodar')
  process.exit(1)
}
const [contaBase, dominioBase] = EMAIL_BASE.split('@')

const carimbo = Date.now()
const emailDeTeste = (rotulo) => `${contaBase}+qa-${rotulo}-${carimbo}@${dominioBase}`

let passou = 0
let falhou = 0

function ok(nome) { passou++; console.log(`  ✓ ${nome}`) }
function erro(nome, detalhe) { falhou++; console.log(`  ✗ ${nome}\n      ${detalhe}`) }

/**
 * Garante que o erro veio da regra que queremos testar, e não de tabela ausente
 * ou de qualquer outra falha — senão o teste negativo vira falso positivo.
 */
function exigeBloqueio(error, padraoEsperado) {
  if (error.code === 'PGRST205') {
    throw new Error('tabela ausente — o resultado não prova nada')
  }
  if (!padraoEsperado.test(error.message)) {
    throw new Error(`bloqueou pelo motivo errado: ${error.code} ${error.message}`)
  }
}

async function checa(nome, fn) {
  try {
    const r = await fn()
    r === false ? erro(nome, 'condição falsa') : ok(nome)
  } catch (e) {
    erro(nome, e?.message ?? String(e))
  }
}

function cliente() {
  return createClient(URL_SB, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function criarUsuario(rotulo, empresaNome) {
  const sb = cliente()
  const email = emailDeTeste(rotulo)
  const senha = `Teste!${carimbo}`
  const { data, error } = await sb.auth.signUp({
    email, password: senha,
    options: { data: { nome: `Teste ${rotulo}`, ...(empresaNome ? { empresa_nome: empresaNome } : {}) } },
  })
  if (error) throw new Error(`signUp ${rotulo}: ${error.message}`)
  if (!data.session) {
    throw new Error(
      'signUp não devolveu sessão — desligue "Confirm email" em Auth → Providers → Email ' +
      'no painel do Supabase e rode de novo.',
    )
  }
  return { sb, email, senha, userId: data.user.id }
}

console.log(`\nMaintenex · smoke test\n${URL_SB}\n`)

// ---------------------------------------------------------------- estrutura
console.log('Estrutura do banco')
const publico = cliente()
for (const tabela of ['empresas', 'profiles', 'convites', 'cidades', 'setores',
                      'equipamentos', 'checklists', 'checklist_itens',
                      'materiais', 'estoque', 'movimentacoes', 'pendencias']) {
  await checa(`tabela ${tabela} existe`, async () => {
    const { error } = await publico.from(tabela).select('id').limit(1)
    if (error?.code === 'PGRST205') throw new Error('tabela ausente — aplique 0001_init.sql')
    if (error && error.code !== '42501' && !/permission denied|row-level security/i.test(error.message)) {
      throw new Error(`${error.code}: ${error.message}`)
    }
    return true
  })
}

await checa('anon não lê dados (RLS)', async () => {
  const { data, error } = await publico.from('empresas').select('id').limit(1)
  if (error?.code === 'PGRST205') throw new Error('tabela ausente — o resultado não prova nada')
  if (data && data.length) throw new Error('anon conseguiu ler empresas')
  return true
})

if (falhou) {
  console.log(`\n${falhou} falha(s) de estrutura. Aplique supabase/migrations/0001_init.sql antes de seguir.\n`)
  process.exit(1)
}

// ---------------------------------------------------------------- empresa A
console.log('\nAuto-cadastro e papéis')
const A = await criarUsuario('a', `Empresa A ${carimbo}`)
let empresaA
await checa('usuário A virou owner de uma empresa nova', async () => {
  const { data, error } = await A.sb.from('profiles').select('*, empresas(*)').eq('id', A.userId).single()
  if (error) throw error
  if (data.papel !== 'owner') throw new Error(`papel esperado owner, veio ${data.papel}`)
  if (!data.empresa_id) throw new Error('sem empresa_id')
  empresaA = data.empresa_id
  return true
})

await checa('A não consegue se promover a super_admin', async () => {
  const { error } = await A.sb.from('profiles').update({ papel: 'super_admin' }).eq('id', A.userId)
  if (!error) throw new Error('escalação de privilégio permitida!')
  exigeBloqueio(error, /próprio papel|super_admin|row-level security|permission denied/i)
  return true
})

await checa('A não consegue convidar como super_admin', async () => {
  const { error } = await A.sb.from('convites').insert({
    empresa_id: empresaA, email: emailDeTeste('x'), papel: 'super_admin',
  })
  if (!error) throw new Error('convite super_admin permitido!')
  exigeBloqueio(error, /super_admin|row-level security|permission denied/i)
  return true
})

// ---------------------------------------------------------------- operação
console.log('\nCadastro e operação')
let cidadeA, setorA, equipA, materialA
await checa('cria cidade', async () => {
  const { data, error } = await A.sb.from('cidades')
    .insert({ empresa_id: empresaA, nome: `Cidade ${carimbo}`, uf: 'PR' }).select().single()
  if (error) throw error
  cidadeA = data.id
  return true
})

await checa('cria setor', async () => {
  const { data, error } = await A.sb.from('setores')
    .insert({ empresa_id: empresaA, cidade_id: cidadeA, nome: 'Manutenção' }).select().single()
  if (error) throw error
  setorA = data.id
  return true
})

await checa('cria equipamento', async () => {
  const { data, error } = await A.sb.from('equipamentos').insert({
    empresa_id: empresaA, cidade_id: cidadeA, setor_id: setorA,
    codigo: `EQP-${carimbo}`, nome: 'Multifuncional de teste', status: 'ativo',
  }).select().single()
  if (error) throw error
  equipA = data.id
  return true
})

await checa('cria checklist com itens', async () => {
  const { data, error } = await A.sb.from('checklists').insert({
    empresa_id: empresaA, equipamento_id: equipA, titulo: 'Preventiva de teste', tipo: 'preventiva',
  }).select().single()
  if (error) throw error
  const { error: e2 } = await A.sb.from('checklist_itens').insert(
    ['Item 1', 'Item 2'].map((descricao, i) => ({
      empresa_id: empresaA, checklist_id: data.id, descricao, ordem: i + 1,
    })),
  )
  if (e2) throw e2
  return true
})

await checa('cria material', async () => {
  const { data, error } = await A.sb.from('materiais').insert({
    empresa_id: empresaA, codigo: `MAT-${carimbo}`, nome: 'Toner de teste', unidade: 'un', estoque_minimo: 2,
  }).select().single()
  if (error) throw error
  materialA = data.id
  return true
})

await checa('movimentação de entrada atualiza o saldo (trigger)', async () => {
  const { error } = await A.sb.from('movimentacoes').insert({
    empresa_id: empresaA, material_id: materialA, cidade_id: cidadeA,
    tipo: 'entrada', quantidade: 7, motivo: 'Compra de teste',
  })
  if (error) throw error
  const { data, error: e2 } = await A.sb.from('estoque')
    .select('quantidade').eq('material_id', materialA).eq('cidade_id', cidadeA).single()
  if (e2) throw e2
  if (data.quantidade !== 7) throw new Error(`saldo esperado 7, veio ${data.quantidade}`)
  return true
})

await checa('saída reduz o saldo', async () => {
  const { error } = await A.sb.from('movimentacoes').insert({
    empresa_id: empresaA, material_id: materialA, cidade_id: cidadeA,
    tipo: 'saida', quantidade: 3, motivo: 'Consumo de teste',
  })
  if (error) throw error
  const { data } = await A.sb.from('estoque')
    .select('quantidade').eq('material_id', materialA).eq('cidade_id', cidadeA).single()
  if (data.quantidade !== 4) throw new Error(`saldo esperado 4, veio ${data.quantidade}`)
  return true
})

await checa('cria pendência', async () => {
  const { error } = await A.sb.from('pendencias').insert({
    empresa_id: empresaA, cidade_id: cidadeA, equipamento_id: equipA,
    titulo: 'Pendência de teste', prioridade: 'alta',
  })
  if (error) throw error
  return true
})

// ---------------------------------------------------------------- isolamento
console.log('\nIsolamento entre empresas')
const B = await criarUsuario('b', `Empresa B ${carimbo}`)

await checa('B não enxerga equipamentos de A', async () => {
  const { data, error } = await B.sb.from('equipamentos').select('id').eq('id', equipA)
  if (error) throw new Error(`${error.code}: ${error.message}`)
  if (data?.length) throw new Error('vazou equipamento entre empresas!')
  return true
})

await checa('B não enxerga a empresa de A', async () => {
  const { data, error } = await B.sb.from('empresas').select('id').eq('id', empresaA)
  if (error) throw new Error(`${error.code}: ${error.message}`)
  if (data?.length) throw new Error('vazou empresa!')
  return true
})

await checa('B não escreve na empresa de A', async () => {
  const { error } = await B.sb.from('equipamentos').insert({
    empresa_id: empresaA, cidade_id: cidadeA, codigo: `INVASOR-${carimbo}`, nome: 'invasor',
  })
  if (!error) throw new Error('escrita cruzada permitida!')
  exigeBloqueio(error, /row-level security|permission denied/i)
  return true
})

await checa('B não altera o perfil de A', async () => {
  const { data, error } = await B.sb.from('profiles').update({ nome: 'hackeado' }).eq('id', A.userId).select()
  if (error) exigeBloqueio(error, /row-level security|permission denied/i)
  if (data?.length) throw new Error('alterou perfil de outra empresa!')
  return true
})

// ---------------------------------------------------------------- convite
console.log('\nConvites')
await checa('owner registra convite para a própria empresa', async () => {
  const { error } = await A.sb.from('convites').insert({
    empresa_id: empresaA, email: emailDeTeste('convidado'), papel: 'tecnico',
  })
  if (error) throw error
  return true
})

await checa('convidado entra na empresa com o papel do convite', async () => {
  const sb = cliente()
  const { data, error } = await sb.auth.signUp({
    email: emailDeTeste('convidado'), password: `Teste!${carimbo}`,
    options: { data: { nome: 'Convidado' } },
  })
  if (error) throw error
  if (!data.session) throw new Error('sem sessão — confirme o e-mail ou desligue Confirm email')
  const { data: perfil, error: e2 } = await sb.from('profiles').select('*').eq('id', data.user.id).single()
  if (e2) throw e2
  if (perfil.empresa_id !== empresaA) throw new Error('convidado não entrou na empresa correta')
  if (perfil.papel !== 'tecnico') throw new Error(`papel esperado tecnico, veio ${perfil.papel}`)
  return true
})

console.log(`\n${passou} passou · ${falhou} falhou\n`)
process.exit(falhou ? 1 : 0)
