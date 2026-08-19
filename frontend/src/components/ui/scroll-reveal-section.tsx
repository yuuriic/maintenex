import { useEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from '@/lib/utils'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

interface ScrollRevealSectionProps {
  children: ReactNode
  id?: string
  className?: string
}

export default function ScrollRevealSection({ children, id, className }: ScrollRevealSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const content = contentRef.current
    if (!section || !content || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const context = gsap.context(() => {
      gsap.fromTo(content,
        { y: 130, scale: 0.9, opacity: 0, clipPath: 'inset(16% 4% 0% 4% round 32px)' },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          clipPath: 'inset(0% 0% 0% 0% round 0px)',
          ease: 'power2.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 88%',
            end: 'top 22%',
            scrub: 1,
          },
        },
      )

      gsap.fromTo(content.querySelectorAll('.lp-secao-head, .lp-recursos-orbital'),
        { y: 45, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 72%',
            end: 'top 20%',
            scrub: 1,
          },
        },
      )
    }, section)

    return () => context.revert()
  }, [])

  return (
    <section ref={sectionRef} id={id} className={cn('scroll-reveal-section', className)}>
      <div ref={contentRef} className="scroll-reveal-content">{children}</div>
    </section>
  )
}
