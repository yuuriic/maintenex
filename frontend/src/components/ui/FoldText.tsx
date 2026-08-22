import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import './fold-text.css'

type FoldTextProps = {
  text: string
  duration?: number
  stagger?: number
  className?: string
  style?: CSSProperties
}

export default function FoldText({
  text,
  duration = 0.95,
  stagger = 0.075,
  className = '',
  style,
}: FoldTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const chars = useMemo(() => Array.from(text), [text])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const pieces = Array.from(root.querySelectorAll<HTMLElement>('.fold-text-piece'))
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const interactiveParent = root.closest<HTMLElement>('a, button, [tabindex]')

    const play = () => {
      const reduced = media.matches
      tweenRef.current?.kill()
      tweenRef.current = gsap.fromTo(pieces, {
        opacity: 0,
        rotateX: reduced ? 0 : -92,
        y: reduced ? 0 : 6,
        transformOrigin: '50% 0%',
      }, {
        opacity: 1,
        rotateX: 0,
        y: 0,
        duration: reduced ? 0.18 : duration,
        stagger: reduced ? 0.01 : stagger,
        ease: 'power3.out',
      })
    }

    const ctx = gsap.context(play, root)
    root.addEventListener('mouseenter', play)
    interactiveParent?.addEventListener('focus', play)

    return () => {
      root.removeEventListener('mouseenter', play)
      interactiveParent?.removeEventListener('focus', play)
      tweenRef.current?.kill()
      ctx.revert()
    }
  }, [duration, stagger, text])

  return (
    <span ref={rootRef} className={`fold-text ${className}`.trim()} style={style}>
      <span className="fold-text-sr-only">{text}</span>
      <span className="fold-text-visual" aria-hidden="true">
        {chars.map((char, index) => (
          <span className="fold-text-segment" key={`${char}-${index}`}>
            <span className="fold-text-piece">{char === ' ' ? '\u00a0' : char}</span>
          </span>
        ))}
      </span>
    </span>
  )
}
