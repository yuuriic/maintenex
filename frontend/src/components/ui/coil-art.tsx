import { useId } from 'react'

interface CoilArtProps {
  className?: string
  corA: string
  corB: string
  corC: string
}

/** Arte decorativa abstrata (fitas enroladas, efeito glossy) — inspirada no motivo 3D do site de referência. */
export default function CoilArt({ className, corA, corB, corC }: CoilArtProps) {
  const id = useId()

  return (
    <svg viewBox="0 0 420 420" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={corA} />
          <stop offset="100%" stopColor={corB} />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={corB} />
          <stop offset="100%" stopColor={corC} />
        </linearGradient>
        <linearGradient id={`${id}-c`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={corC} />
          <stop offset="100%" stopColor={corA} />
        </linearGradient>
        <radialGradient id={`${id}-brilho`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sombra`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#0f1a08" floodOpacity=".22" />
        </filter>
      </defs>

      <g className="coil-art-giro" filter={`url(#${id}-sombra)`}>
        <ellipse cx="150" cy="130" rx="150" ry="66" fill={`url(#${id}-a)`} stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.5" transform="rotate(-22 150 130)" />
        <ellipse cx="255" cy="205" rx="158" ry="64" fill={`url(#${id}-b)`} stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.5" transform="rotate(16 255 205)" />
        <ellipse cx="190" cy="290" rx="140" ry="60" fill={`url(#${id}-c)`} stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.5" transform="rotate(-10 190 290)" />
        <ellipse cx="112" cy="98" rx="34" ry="18" fill={`url(#${id}-brilho)`} transform="rotate(-22 112 98)" />
        <ellipse cx="300" cy="168" rx="30" ry="15" fill={`url(#${id}-brilho)`} opacity=".8" transform="rotate(16 300 168)" />
        <ellipse cx="235" cy="265" rx="26" ry="13" fill={`url(#${id}-brilho)`} opacity=".6" transform="rotate(-10 235 265)" />
      </g>
    </svg>
  )
}
