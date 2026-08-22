import { useEffect, useRef } from 'react'

interface CursorProps {
  size?: number
}

export function Cursor({ size = 52 }: CursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const currentRef = useRef({ x: -size, y: -size })
  const targetRef = useRef({ x: -size, y: -size })

  useEffect(() => {
    const cursor = cursorRef.current
    const finePointer = window.matchMedia('(pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!cursor || !finePointer.matches) return

    const previousCursor = document.body.style.cursor
    document.body.style.cursor = 'none'

    const handleMove = (event: MouseEvent) => {
      targetRef.current = { x: event.clientX - size / 2, y: event.clientY - size / 2 }
      cursor.dataset.visible = 'true'
    }
    const handleLeave = () => { cursor.dataset.visible = 'false' }
    const handleEnter = () => { cursor.dataset.visible = 'true' }

    const animate = () => {
      const ease = reducedMotion.matches ? 1 : 0.2
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * ease
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * ease
      cursor.style.transform = `translate3d(${currentRef.current.x}px, ${currentRef.current.y}px, 0)`
      frameRef.current = requestAnimationFrame(animate)
    }

    document.addEventListener('mousemove', handleMove, { passive: true })
    document.documentElement.addEventListener('mouseenter', handleEnter)
    document.documentElement.addEventListener('mouseleave', handleLeave)
    frameRef.current = requestAnimationFrame(animate)

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.documentElement.removeEventListener('mouseenter', handleEnter)
      document.documentElement.removeEventListener('mouseleave', handleLeave)
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      document.body.style.cursor = previousCursor
    }
  }, [size])

  return (
    <div
      ref={cursorRef}
      className="lp-inverted-cursor"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

export default Cursor
