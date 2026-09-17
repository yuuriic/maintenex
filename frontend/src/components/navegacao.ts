import {
  BarChart3, Boxes, Building2, ClipboardCheck, LayoutDashboard, Printer, Settings, TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

export interface ItemNav {
  /** Identificador estável — base para os atalhos personalizáveis do usuário. */
  id: string
  rotulo: string
  /** Rótulo compacto para a bottom navigation; cai no rotulo quando ausente. */
  rotuloCurto?: string
  caminho: string
  icone: LucideIcon
  atalho: string
  /** Restringe o item ao papel de plataforma. */
  soSuperAdmin?: boolean
  /** Ordem na navegação mobile: os menores viram atalhos da bottom nav, o resto vai para "Mais". */
  prioridadeMobile: number
}

export const navegacao: ItemNav[] = [
  { id: 'dashboard', rotulo: 'Dashboard', caminho: '/app', icone: LayoutDashboard, atalho: 'D', prioridadeMobile: 1 },
  { id: 'checklist', rotulo: 'Checklist', caminho: '/app/checklist', icone: ClipboardCheck, atalho: 'C', prioridadeMobile: 2 },
  { id: 'equipamentos', rotulo: 'Equipamentos', caminho: '/app/equipamentos', icone: Printer, atalho: 'E', prioridadeMobile: 3 },
  { id: 'estoque', rotulo: 'Estoque Geral', rotuloCurto: 'Estoque', caminho: '/app/estoque', icone: Boxes, atalho: 'S', prioridadeMobile: 5 },
  { id: 'pendencias', rotulo: 'Pendências', caminho: '/app/pendencias', icone: TriangleAlert, atalho: 'P', prioridadeMobile: 4 },
  { id: 'relatorios', rotulo: 'Relatórios', caminho: '/app/relatorios', icone: BarChart3, atalho: 'R', prioridadeMobile: 6 },
  { id: 'configuracoes', rotulo: 'Configurações', caminho: '/app/configuracoes', icone: Settings, atalho: 'G', prioridadeMobile: 7 },
  { id: 'empresas', rotulo: 'Empresas', caminho: '/app/empresas', icone: Building2, atalho: 'M', soSuperAdmin: true, prioridadeMobile: 8 },
]

/** Quantos módulos cabem na bottom nav antes do item "Mais". */
export const LIMITE_ATALHOS_MOBILE = 4

export function navegacaoVisivel(ehSuperAdmin: boolean) {
  return navegacao.filter((item) => !item.soSuperAdmin || ehSuperAdmin)
}

/**
 * Deriva a navegação mobile da MESMA lista da sidebar: a autorização é a de
 * navegacaoVisivel, aqui só muda a apresentação. `atalhosPersonalizados` (ids,
 * em ordem) é o gancho para a futura tela "Personalizar atalhos"; ids inválidos
 * ou sem permissão são ignorados e o restante é completado pela prioridade padrão.
 */
export function navegacaoMobile(ehSuperAdmin: boolean, atalhosPersonalizados: string[] = []) {
  const visiveis = navegacaoVisivel(ehSuperAdmin)
  const porPrioridade = [...visiveis].sort((a, b) => a.prioridadeMobile - b.prioridadeMobile)
  const escolhidos = atalhosPersonalizados
    .map((id) => visiveis.find((item) => item.id === id))
    .filter((item): item is ItemNav => !!item)
  const atalhos = [...escolhidos, ...porPrioridade.filter((item) => !escolhidos.includes(item))]
    .slice(0, LIMITE_ATALHOS_MOBILE)
  // "Mais" mantém a ordem da sidebar para o usuário reconhecer a mesma sequência do desktop.
  const demais = visiveis.filter((item) => !atalhos.includes(item))
  return { atalhos, demais }
}
