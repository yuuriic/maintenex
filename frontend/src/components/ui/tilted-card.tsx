import { useRef, type MouseEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'

interface TiltedCardProps {
  children: ReactNode
  rotateAmplitude?: number
  scaleOnHover?: number
}

const springValues = { damping: 30, stiffness: 100, mass: 2 }

export default function TiltedCard({ children, rotateAmplitude = 15, scaleOnHover = 1.08 }: TiltedCardProps) {
  const ref = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const rotateX = useSpring(useMotionValue(0), springValues)
  const rotateY = useSpring(useMotionValue(0), springValues)
  const scale = useSpring(1, springValues)

  function handleMouse(event: MouseEvent<HTMLElement>) {
    if (!ref.current || reducedMotion) return
    const rect = ref.current.getBoundingClientRect()
    const offsetX = event.clientX - rect.left - rect.width / 2
    const offsetY = event.clientY - rect.top - rect.height / 2
    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude)
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude)
  }

  function handleMouseEnter() {
    if (!reducedMotion) scale.set(scaleOnHover)
  }

  function handleMouseLeave() {
    scale.set(1)
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <figure ref={ref} className="tilted-card-figure"
      onMouseMove={handleMouse} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <motion.div className="tilted-card-inner" style={{ rotateX, rotateY, scale }}>
        {children}
      </motion.div>
    </figure>
  )
}
