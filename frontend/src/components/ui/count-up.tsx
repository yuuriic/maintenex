import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'

interface CountUpProps {
  to: number
  decimals?: number
  suffix?: string
  duration?: number
}

export default function CountUp({ to, decimals = 0, suffix = '', duration = 1.4 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const reducedMotion = useReducedMotion()
  const [valor, setValor] = useState(reducedMotion ? to : 0)

  useEffect(() => {
    if (!inView || reducedMotion) return
    const controls = animate(0, to, {
      duration,
      ease: 'easeOut',
      onUpdate: setValor,
    })
    return () => controls.stop()
  }, [inView, reducedMotion, to, duration])

  return (
    <span ref={ref}>
      {valor.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}
