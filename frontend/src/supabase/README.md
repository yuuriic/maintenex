# Maintenex — Schema Supabase

Este diretório contém a estrutura de banco de dados e migrations do Maintenex.

## 📁 Estrutura

### `migrations/`
Migrations reproduzíveis e ordenadas do schema Supabase.

**Ordem de aplicação para novos ambientes:**
1. `0001_init.sql` — schema base completo (enums, tabelas, triggers, RLS)
2. `0002_seed.sql` — ⚠️ **seed de demonstração opcional** (ver abaixo)
3. `0006_verificacao_cadastro.sql` — adiciona `telefone` e `email_verificado` + trigger de sincronização com Auth
4. `0007_restringir_funcao_verificacao.sql` — revoga execução da função de sync
5. `0008_hardening_autorizacao.sql` — endurece `empresa_atual()`, `proteger_papel()` e revogações
6. `0009_detalhes_checklist.sql` — adiciona `checklists.tecnico_nome`
7. `0010_secoes_checklist.sql` — adiciona `checklist_itens.secao`

**Aplicação automática via Supabase CLI:**
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

### `admin-scripts/`
Scripts administrativos manuais que **nunca devem ser executados por `db push` automático**.

Contém:
- `0003_promover_super_admin.sql` — promove usuário existente a `super_admin`
- `0004_criar_super_admin.sql` — cria conta `super_admin` do zero
- `0005_reparar_admin.sql` — repara/recria conta administrativa

**Importante:**
- Todos exigem alterar `email_admin` de `'ALTERE_PARA_EMAIL_ADMIN'` para email real
- Executar **somente no SQL Editor** após criar o ambiente
- Uso controlado para administração da plataforma

### `setup-completo.sql`
Snapshot consolidado do estado final do schema.

**Uso recomendado:**
- Bootstrap manual via SQL Editor do Supabase Dashboard
- Referência consolidada para revisão
- Recuperação controlada

**Não deve substituir migrations incrementais** no fluxo normal de desenvolvimento.

**Contém:**
- Schema completo equivalente a `0001` + `0006`–`0010`
- Trigger de sincronização `auth.users` → `profiles`
- RLS completo e hardenings
- Seed de demonstração ao final (opcional)

### `testes/`
Stubs e testes locais de RLS.

Não aplicar em ambientes reais.

---

## ⚠️ Seed de Demonstração (`0002_seed.sql`)

**Natureza:** dados fictícios, **não** evolução de schema.

**Comportamento:**
- Seleciona a primeira empresa por `order by criado_em limit 1`
- No-op se `empresas` estiver vazio
- Parcialmente idempotente (usa `on conflict do nothing`)
- Usa datas relativas e UUIDs gerados

**Recomendação:**
- **Não executar automaticamente** durante `db push` em ambientes controlados
- Executar **manualmente** via SQL Editor apenas após criar a empresa de teste
- Considerar como dados de demonstração opcional, não requisito de schema

Para staging/production, considere criar seeds específicos e controlados separadamente.

---

## 🏗️ Criação de Novo Ambiente

### Opção A: Migrations Incrementais (Recomendado)

```bash
# 1. Criar projeto Supabase via Dashboard
# 2. Vincular localmente
cd frontend/src/supabase
supabase login
supabase link --project-ref <NEW_PROJECT_REF>

# 3. Aplicar migrations (executa 0001, 0002, 0006-0010)
supabase db push

# 4. (Opcional) Se não quiser seed automático, remova/renomeie 0002 antes do push

# 5. Criar primeira conta owner pelo app
# Acessar /login?modo=cadastrar e criar conta com nome da empresa

# 6. (Opcional) Executar seed manualmente se quiser dados demo
# SQL Editor: executar conteúdo de 0002_seed.sql

# 7. (Opcional) Super_admin somente se necessário
# SQL Editor: editar e executar admin-scripts/0003_promover_super_admin.sql
```

### Opção B: Setup Consolidado Manual

```bash
# 1. Criar projeto Supabase via Dashboard
# 2. SQL Editor do Dashboard
# 3. Copiar e colar todo o conteúdo de setup-completo.sql
# 4. Executar
# 5. Criar primeira conta owner pelo app
# 6. O seed já está incluído no consolidado (executará após empresa existir)
```

---

## 🔒 Modelo Multi-Tenant

### Isolamento
- Tabelas operacionais carregam `empresa_id`
- RLS valida `row.empresa_id = empresa_atual()`
- `super_admin` tem bypass cross-tenant via `eh_super_admin()`

### Papéis e Permissões

| Papel | Cadastros<br/>(cidades, setores, equipamentos, materiais) | Operação<br/>(checklists, estoque, movimentações, pendências) | Empresas | Profiles | Convites |
|-------|-------|-------|-------|-------|-------|
| `leitor` | read | read | — | self | — |
| `tecnico` | read | read + write | — | self | — |
| `gestor` | read + write | read + write | — | self | — |
| `owner` | read + write | read + write | own (select+update) | admin empresa | admin empresa |
| `super_admin` | all cross-tenant | all cross-tenant | all | all | all |

### Triggers SECURITY DEFINER
- `handle_new_user()` — auto-cadastro de empresa ou aceite de convite
- `aplicar_movimentacao()` — atualiza saldo de `estoque` após `movimentacoes`
- `proteger_papel()` — impede auto-escalação e protege campos sensíveis
- `proteger_convite()` — impede convite `super_admin` e cross-empresa
- `sincronizar_verificacao_usuario()` — sincroniza `auth.users` → `profiles`

### Hardening (0008)
- `empresa_atual()` bloqueia empresas `suspensa`/`cancelada`
- `proteger_papel()` estendido para proteger `ativo`, `email`, `telefone`, `email_verificado`, `criado_em`
- Revogações explícitas: triggers não são endpoints RPC

---

## 🧪 Validação de Ambiente

Após aplicar schema, validar com:

```sql
-- Validar tabelas
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
  'empresas','profiles','convites','cidades','setores',
  'equipamentos','checklists','checklist_itens','materiais',
  'estoque','movimentacoes','pendencias'
);
-- Esperado: 12

-- Validar trigger crítico de sincronização
SELECT exists (
  SELECT 1 FROM pg_trigger 
  WHERE tgname = 'z_sync_auth_user_verification'
);
-- Esperado: true

-- Validar função crítica
SELECT to_regprocedure('public.sincronizar_verificacao_usuario()') IS NOT NULL;
-- Esperado: true

-- Validar políticas RLS
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
-- Esperado: > 0

-- Validar colunas adicionadas por migrations
SELECT 
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='telefone'),
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email_verificado'),
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='checklists' AND column_name='tecnico_nome'),
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='checklist_itens' AND column_name='secao');
-- Esperado: t, t, t, t
```

---

## 📋 Checklist de Staging Seguro

Antes de considerar staging pronto:

- [ ] Migrations aplicadas sem scripts administrativos no fluxo automático
- [ ] Trigger `z_sync_auth_user_verification` confirmado
- [ ] Função `sincronizar_verificacao_usuario()` confirmada
- [ ] 12 tabelas públicas validadas
- [ ] RLS ativo em todas as tabelas
- [ ] Conta owner de teste criada e confirmada
- [ ] `profiles.telefone` e `profiles.email_verificado` populados
- [ ] Empresa de teste com status `ativa`
- [ ] URL staging **não é produção**
- [ ] Variáveis de ambiente staging configuradas (Vercel + GitHub Secrets)
- [ ] Sem credenciais hardcoded

---

## 🔍 Fonte Oficial de Schema

**`migrations/`** é a fonte de verdade oficial para:
- Criação de novos ambientes
- Evolução incremental de ambientes existentes
- Histórico auditável de alterações
- Reprodutibilidade entre ambientes

**`setup-completo.sql`** é útil para:
- Bootstrap manual rápido
- Revisão consolidada
- Casos de recuperação controlada

Mas não substitui migrations no fluxo normal.

---

## 🚧 Melhorias Futuras

Identificadas mas não implementadas ainda:

- **Integridade cross-table FK:** validar que `cidade_id`, `material_id`, `equipamento_id`, `checklist_id` pertencem à mesma `empresa_id` em operações críticas
- **Separação de seed:** considerar mover `0002_seed.sql` para estrutura de seeds separada se histórico permitir
