import { useEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'

type PreloaderProps = {
  onComplete: () => void
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const preloaderRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const letters = useMemo(() => Array.from('Maintenex'), [])

  useEffect(() => {
    const preloader = preloaderRef.current
    const text = textRef.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!preloader || !text || reducedMotion) {
      onComplete()
      return
    }

    const letterElements = Array.from(text.querySelectorAll<HTMLElement>('.preloader-letter'))

    const finish = () => {
      preloader.style.display = 'none'
      onComplete()
    }

    const tl = gsap.timeline({ onComplete: finish })

    tl.fromTo(
      letterElements,
      {
        opacity: 0,
        y: 24,
        rotateX: -86,
        filter: 'blur(10px)',
        transformOrigin: '50% 100%',
      },
      {
        opacity: 1,
        y: 0,
        rotateX: 0,
        filter: 'blur(0px)',
        duration: 0.82,
        ease: 'power3.out',
        stagger: 0.065,
      }
    )
      .to({}, { duration: 0.8 })
      .to(letterElements, {
        opacity: 0,
        y: -22,
        rotateX: 78,
        filter: 'blur(8px)',
        duration: 0.42,
        ease: 'power2.in',
        stagger: {
          each: 0.038,
          from: 'end',
        },
      })
      .to(
        preloader,
        {
          yPercent: -100,
          duration: 0.72,
          ease: 'power3.inOut',
        },
        '-=0.18'
      )

    const safetyTimeout = window.setTimeout(() => {
      if (preloader.style.display !== 'none') {
        tl.kill()
        finish()
      }
    }, 4000)

    return () => {
      window.clearTimeout(safetyTimeout)
      tl.kill()
    }
  }, [onComplete])

  return (
    <div
      ref={preloaderRef}
      className="preloader"
      role="status"
      aria-label="Carregando Maintenex"
    >
      <div className="preloader-content">
        <div ref={textRef} className="preloader-text" aria-hidden="true">
          {letters.map((letter, index) => (
            <span className="preloader-letter" data-letter={letter} key={`${letter}-${index}`}>
              {letter}
            </span>
          ))}
        </div>
        <span className="preloader-sr-only">Carregando Maintenex</span>
      </div>
    </div>
  )
}
