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
 * Cruza ids salvos (profiles.atalhos_mobile) com o que o usuário pode ver: descarta
 * ids desconhecidos, duplicados e módulos sem permissão, e corta no limite da barra.
 * É a única porta de entrada da preferência persistida — ela nunca concede acesso.
 */
export function filtrarAtalhosPermitidos(ids: readonly string[], ehSuperAdmin: boolean) {
  const visiveis = navegacaoVisivel(ehSuperAdmin)
  const unicos = ids.filter((id, indice) => ids.indexOf(id) === indice)
  return unicos
    .map((id) => visiveis.find((item) => item.id === id))
    .filter((item): item is ItemNav => !!item)
    .slice(0, LIMITE_ATALHOS_MOBILE)
}

/** Atalhos que a barra mostra quando o usuário nunca personalizou: os de menor prioridade. */
export function atalhosPadrao(ehSuperAdmin: boolean) {
  return [...navegacaoVisivel(ehSuperAdmin)]
    .sort((a, b) => a.prioridadeMobile - b.prioridadeMobile)
    .slice(0, LIMITE_ATALHOS_MOBILE)
}

/**
 * Deriva a navegação mobile da MESMA lista da sidebar: a autorização é a de
 * navegacaoVisivel, aqui só muda a apresentação. Com `atalhosPersonalizados`
 * (ids em ordem, vindos do perfil) a barra mostra exatamente o que o usuário
 * escolheu e ainda tem permissão de ver — pode ser menos que o limite. Sem
 * personalização (null) ou se nada sobrar após o filtro, vale a prioridade padrão.
 */
export function navegacaoMobile(ehSuperAdmin: boolean, atalhosPersonalizados?: readonly string[] | null) {
  const visiveis = navegacaoVisivel(ehSuperAdmin)
  const escolhidos = atalhosPersonalizados ? filtrarAtalhosPermitidos(atalhosPersonalizados, ehSuperAdmin) : []
  const atalhos = escolhidos.length ? escolhidos : atalhosPadrao(ehSuperAdmin)
  // "Mais" mantém a ordem da sidebar para o usuário reconhecer a mesma sequência do desktop.
  const demais = visiveis.filter((item) => !atalhos.includes(item))
  return { atalhos, demais }
}
