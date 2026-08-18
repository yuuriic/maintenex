import {
  BarChart3, Boxes, Building2, ClipboardCheck, LayoutDashboard, Printer, Settings, TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

export interface ItemNav {
  rotulo: string
  caminho: string
  icone: LucideIcon
  atalho: string
  /** Restringe o item ao papel de plataforma. */
  soSuperAdmin?: boolean
}

export const navegacao: ItemNav[] = [
  { rotulo: 'Dashboard', caminho: '/app', icone: LayoutDashboard, atalho: 'D' },
  { rotulo: 'Checklist', caminho: '/app/checklist', icone: ClipboardCheck, atalho: 'C' },
  { rotulo: 'Equipamentos', caminho: '/app/equipamentos', icone: Printer, atalho: 'E' },
  { rotulo: 'Estoque Geral', caminho: '/app/estoque', icone: Boxes, atalho: 'S' },
  { rotulo: 'Pendências', caminho: '/app/pendencias', icone: TriangleAlert, atalho: 'P' },
  { rotulo: 'Relatórios', caminho: '/app/relatorios', icone: BarChart3, atalho: 'R' },
  { rotulo: 'Configurações', caminho: '/app/configuracoes', icone: Settings, atalho: 'G' },
  { rotulo: 'Empresas', caminho: '/app/empresas', icone: Building2, atalho: 'M', soSuperAdmin: true },
]

export function navegacaoVisivel(ehSuperAdmin: boolean) {
  return navegacao.filter((item) => !item.soSuperAdmin || ehSuperAdmin)
}
