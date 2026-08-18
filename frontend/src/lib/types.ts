export type PapelUsuario = 'super_admin' | 'owner' | 'gestor' | 'tecnico' | 'leitor'
export type StatusEmpresa = 'ativa' | 'suspensa' | 'cancelada'
export type StatusEquipamento = 'ativo' | 'manutencao' | 'inativo'
export type TipoChecklist = 'preventiva' | 'corretiva'
export type StatusChecklist = 'pendente' | 'em_andamento' | 'concluido' | 'cancelado'
export type PrioridadePendencia = 'baixa' | 'media' | 'alta' | 'critica'
export type StatusPendencia = 'aberta' | 'em_andamento' | 'resolvida' | 'cancelada'
export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste'

export interface Empresa {
  id: string; nome: string; slug: string; cnpj: string | null
  email_principal: string | null; telefone: string | null
  status: StatusEmpresa; criado_por: string | null; criado_em: string
}

export interface Convite {
  id: string; empresa_id: string; email: string; papel: PapelUsuario
  criado_por: string | null; aceito_em: string | null; expira_em: string; criado_em: string
}

export interface Cidade { id: string; empresa_id: string; nome: string; uf: string; ativa: boolean; criado_em: string }
export interface Setor { id: string; empresa_id: string; cidade_id: string; nome: string; responsavel: string | null; criado_em: string }

export interface Profile {
  id: string; empresa_id: string | null; nome: string; email: string; papel: PapelUsuario
  cidade_id: string | null; avatar_url: string | null; ativo: boolean; criado_em: string
  empresas?: Pick<Empresa, 'id' | 'nome' | 'slug' | 'status'> | null
}

export interface Equipamento {
  id: string; empresa_id: string; cidade_id: string; setor_id: string | null; codigo: string; nome: string
  marca: string | null; modelo: string | null; numero_serie: string | null; localizacao: string | null
  status: StatusEquipamento; contador: number
  ultima_manutencao: string | null; proxima_manutencao: string | null; criado_em: string
  setores?: Pick<Setor, 'id' | 'nome'> | null
  cidades?: Pick<Cidade, 'id' | 'nome' | 'uf'> | null
}

export interface Checklist {
  id: string; empresa_id: string; equipamento_id: string; tipo: TipoChecklist; status: StatusChecklist; titulo: string
  responsavel_id: string | null; data_prevista: string; data_conclusao: string | null
  observacoes: string | null; criado_em: string
  equipamentos?: Pick<Equipamento, 'id' | 'codigo' | 'nome' | 'cidade_id'> | null
  checklist_itens?: ChecklistItem[]
}

export interface ChecklistItem {
  id: string; empresa_id: string; checklist_id: string; descricao: string; concluido: boolean
  observacao: string | null; ordem: number
}

export interface Material {
  id: string; empresa_id: string; codigo: string; nome: string; categoria: string | null
  unidade: string; estoque_minimo: number; criado_em: string
}

export interface Estoque {
  id: string; empresa_id: string; material_id: string; cidade_id: string; quantidade: number; atualizado_em: string
  materiais?: Material | null
}

export interface Movimentacao {
  id: string; empresa_id: string; material_id: string; cidade_id: string; equipamento_id: string | null
  tipo: TipoMovimentacao; quantidade: number; motivo: string | null
  usuario_id: string | null; criado_em: string
  materiais?: Pick<Material, 'id' | 'codigo' | 'nome' | 'unidade'> | null
}

export interface Pendencia {
  id: string; empresa_id: string; cidade_id: string; equipamento_id: string | null; titulo: string; descricao: string | null
  prioridade: PrioridadePendencia; status: StatusPendencia; responsavel_id: string | null
  aberta_em: string; fechada_em: string | null
  equipamentos?: Pick<Equipamento, 'id' | 'codigo' | 'nome'> | null
}

/** Tipagem mínima aceita pelo createClient — as queries usam os tipos acima. */
export type Database = any
