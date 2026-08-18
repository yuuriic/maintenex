import type { LucideIcon } from 'lucide-react'

/**
 * Ícone lucide com animação de "desenho": os paths recebem stroke-dasharray via CSS
 * e são redesenhados no hover, junto de um leve pop de escala.
 * A animação real vive em styles.css (.icone-desenho).
 */
export function AnimatedIcon({ icon: Icon, size = 19 }: { icon: LucideIcon; size?: number }) {
  return (
    <span className="icone-desenho" aria-hidden>
      <Icon size={size} strokeWidth={1.9} />
    </span>
  )
}
