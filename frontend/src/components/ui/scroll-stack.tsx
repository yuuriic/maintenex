import { type ReactNode, useCallback, useLayoutEffect, useRef } from 'react'
import Lenis from 'lenis'
import './scroll-stack.css'

type ScrollStackItemProps = { children: ReactNode; itemClassName?: string }

export function ScrollStackItem({ children, itemClassName = '' }: ScrollStackItemProps) {
  return <div className={`scroll-stack-card ${itemClassName}`.trim()}>{children}</div>
}

type ScrollStackProps = {
  children: ReactNode
  className?: string
  itemDistance?: number
  itemScale?: number
  itemStackDistance?: number
  stackPosition?: string
  scaleEndPosition?: string
  baseScale?: number
  rotationAmount?: number
  blurAmount?: number
  useWindowScroll?: boolean
  onStackComplete?: () => void
}

export default function ScrollStack({
  children, className = '', itemDistance = 100, itemScale = 0.03,
  itemStackDistance = 30, stackPosition = '20%', scaleEndPosition = '10%',
  baseScale = 0.85, rotationAmount = 0, blurAmount = 0,
  useWindowScroll = false, onStackComplete,
}: ScrollStackProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLElement[]>([])
  const frameRef = useRef<number | null>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const completedRef = useRef(false)

  const parsePosition = useCallback((value: string, height: number) =>
    value.includes('%') ? parseFloat(value) / 100 * height : parseFloat(value), [])

  const update = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller || !cardsRef.current.length) return

    if (useWindowScroll) {
      // O painel (.lp-como-stack > .lp-container) fica fixo na tela via CSS
      // position:sticky, e cada .lp-passo-stack é position:absolute; inset:0 —
      // ou seja, os cards já nascem sobrepostos no mesmo lugar. O progresso vem
      // de quanto já se avançou dentro da seção alta (310vh) que contém o sticky;
      // cada card só precisa de um pequeno deslize de entrada, não perseguir scrollY.
      const scene = scroller.closest<HTMLElement>('.lp-como-stack')
      if (!scene) return
      const sceneTop = scene.getBoundingClientRect().top + window.scrollY
      const scrollRange = Math.max(1, scene.offsetHeight - window.innerHeight)
      const sceneProgress = Math.max(0, Math.min(1, (window.scrollY - sceneTop) / scrollRange))
      const enterDistance = Math.max(scroller.clientHeight + 80, 620)

      cardsRef.current.forEach((card, index) => {
        const start = index === 0 ? 0 : index === 1 ? .24 : .59
        const end = index === 0 ? .01 : index === 1 ? .39 : .74
        const progress = index === 0 ? 1 : Math.max(0, Math.min(1, (sceneProgress - start) / (end - start)))
        const translateY = index * itemStackDistance + (1 - progress) * enterDistance
        const rotation = index * rotationAmount * progress
        card.style.transform = `translate3d(0, ${translateY}px, 0) rotate(${rotation}deg)`
        card.style.filter = ''
        card.style.zIndex = String(index + 1)
      })

      const complete = sceneProgress > .92
      if (complete && !completedRef.current) onStackComplete?.()
      completedRef.current = complete
      return
    }

    const scrollTop = scroller.scrollTop
    const height = scroller.clientHeight
    const stackAt = parsePosition(stackPosition, height)
    const scaleEndsAt = parsePosition(scaleEndPosition, height)
    const end = scroller.querySelector<HTMLElement>('.scroll-stack-end')
    const offset = (el: HTMLElement) => el.offsetTop
    const pinEnd = (end ? offset(end) : 0) - height / 2
    let topCard = 0

    cardsRef.current.forEach((card, index) => {
      if (scrollTop >= offset(card) - stackAt - itemStackDistance * index) topCard = index
    })

    cardsRef.current.forEach((card, index) => {
      const top = offset(card)
      const start = top - stackAt - itemStackDistance * index
      const scaleEnd = top - scaleEndsAt
      const progress = Math.max(0, Math.min(1, (scrollTop - start) / Math.max(1, scaleEnd - start)))
      const scale = 1 - progress * (1 - (baseScale + index * itemScale))
      const translateY = scrollTop < start ? 0 : scrollTop <= pinEnd
        ? scrollTop - top + stackAt + itemStackDistance * index
        : pinEnd - top + stackAt + itemStackDistance * index
      const rotation = index * rotationAmount * progress
      const blur = index < topCard ? (topCard - index) * blurAmount : 0
      card.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale}) rotate(${rotation}deg)`
      card.style.filter = blur ? `blur(${blur}px)` : ''

      if (index === cardsRef.current.length - 1) {
        const active = scrollTop >= start && scrollTop <= pinEnd
        if (active && !completedRef.current) onStackComplete?.()
        completedRef.current = active
      }
    })
  }, [baseScale, blurAmount, itemScale, itemStackDistance, onStackComplete, parsePosition, rotationAmount, scaleEndPosition, stackPosition, useWindowScroll])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const cards = Array.from(scroller.querySelectorAll<HTMLElement>('.scroll-stack-card'))
    cardsRef.current = cards
    cards.forEach((card, index) => { if (index < cards.length - 1) card.style.marginBottom = `${itemDistance}px` })

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (useWindowScroll) {
      let ticking = false
      const requestUpdate = () => {
        if (ticking) return
        ticking = true
        frameRef.current = requestAnimationFrame(() => { update(); ticking = false })
      }
      window.addEventListener('scroll', requestUpdate, { passive: true })
      window.addEventListener('resize', requestUpdate)
      update()
      return () => {
        window.removeEventListener('scroll', requestUpdate)
        window.removeEventListener('resize', requestUpdate)
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
        cards.forEach(card => { card.style.transform = ''; card.style.filter = '' })
        cardsRef.current = []
      }
    }

    const lenis = new Lenis({
      wrapper: scroller, content: scroller.querySelector<HTMLElement>('.scroll-stack-inner')!,
      duration: 1.05, smoothWheel: true, syncTouch: true,
    })
    lenis.on('scroll', update)
    const raf = (time: number) => { lenis.raf(time); frameRef.current = requestAnimationFrame(raf) }
    frameRef.current = requestAnimationFrame(raf)
    lenisRef.current = lenis
    update()
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      lenis.destroy()
      cardsRef.current = []
    }
  }, [itemDistance, update, useWindowScroll])

  return <div className={`scroll-stack-scroller ${useWindowScroll ? 'uses-window' : ''} ${className}`.trim()} ref={scrollerRef}>
    <div className="scroll-stack-inner">{children}<div className="scroll-stack-end" /></div>
  </div>
}
