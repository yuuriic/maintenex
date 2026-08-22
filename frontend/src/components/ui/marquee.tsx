import type { HTMLAttributes, ReactNode, CSSProperties } from 'react'
import { cn } from '../../lib/utils'

type MarqueeProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  pauseOnHover?: boolean
  direction?: 'left' | 'right'
  speed?: number
}

export function Marquee({
  children,
  pauseOnHover = true,
  direction = 'left',
  speed = 30,
  className,
  ...props
}: MarqueeProps) {
  return (
    <div className={cn('tech-marquee', className)} {...props}>
      <div
        className={cn('tech-marquee-track', direction === 'right' && 'reverse', pauseOnHover && 'pause-on-hover')}
        style={{ '--marquee-duration': `${speed}s` } as CSSProperties}
      >
        <div className="tech-marquee-group">{children}</div>
        <div className="tech-marquee-group" aria-hidden="true">{children}</div>
      </div>
    </div>
  )
}
