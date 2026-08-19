import { useEffect, useRef, useState, type ElementType, type MouseEvent } from 'react'
import { ArrowRight, Link, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface TimelineItem {
  id: number
  title: string
  date: string
  content: string
  category: string
  icon: ElementType
  relatedIds: number[]
  status: 'completed' | 'in-progress' | 'pending'
  energy: number
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[]
}

export default function RadialOrbitalTimeline({ timelineData }: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({})
  const [rotationAngle, setRotationAngle] = useState(0)
  const [autoRotate, setAutoRotate] = useState(true)
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({})
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const orbitRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const getRelatedItems = (itemId: number) => timelineData.find((item) => item.id === itemId)?.relatedIds ?? []

  const centerViewOnNode = (nodeId: number) => {
    if (!nodeRefs.current[nodeId]) return
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId)
    setRotationAngle(270 - (nodeIndex / timelineData.length) * 360)
  }

  const toggleItem = (id: number) => {
    const opening = !expandedItems[id]
    setExpandedItems(opening ? { [id]: true } : {})
    setActiveNodeId(opening ? id : null)
    setAutoRotate(!opening)
    setPulseEffect(opening
      ? Object.fromEntries(getRelatedItems(id).map((relatedId) => [relatedId, true]))
      : {})
    if (opening) centerViewOnNode(id)
  }

  const handleContainerClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === containerRef.current || event.target === orbitRef.current) {
      setExpandedItems({})
      setActiveNodeId(null)
      setPulseEffect({})
      setAutoRotate(true)
    }
  }

  useEffect(() => {
    if (!autoRotate) return
    const timer = window.setInterval(() => {
      setRotationAngle((previous) => Number(((previous + 0.3) % 360).toFixed(3)))
    }, 50)
    return () => window.clearInterval(timer)
  }, [autoRotate])

  const calculateNodePosition = (index: number) => {
    const angle = ((index / timelineData.length) * 360 + rotationAngle) % 360
    const radian = (angle * Math.PI) / 180
    return {
      x: 245 * Math.cos(radian),
      y: 245 * Math.sin(radian),
      zIndex: Math.round(100 + 50 * Math.cos(radian)),
      opacity: Math.max(0.48, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2))),
    }
  }

  const getStatusStyles = (status: TimelineItem['status']) => {
    if (status === 'completed') return 'text-white bg-black border-white'
    if (status === 'in-progress') return 'text-black bg-white border-black'
    return 'text-white bg-black/40 border-white/50'
  }

  return (
    <div ref={containerRef} onClick={handleContainerClick}
      className="relative flex h-[700px] w-full items-center justify-center overflow-hidden bg-transparent">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.07),transparent_48%)]" />
      <div ref={orbitRef} className="relative flex h-full w-full max-w-4xl items-center justify-center" style={{ perspective: '1000px' }}>
        <div className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 via-zinc-500 to-zinc-900 animate-pulse">
          <div className="absolute h-20 w-20 rounded-full border border-white/20 animate-ping opacity-70" />
          <div className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-md" />
        </div>
        <div className="absolute h-[440px] w-[440px] rounded-full border border-white/10" />

        {timelineData.map((item, index) => {
          const position = calculateNodePosition(index)
          const isExpanded = expandedItems[item.id]
          const isRelated = activeNodeId ? getRelatedItems(activeNodeId).includes(item.id) : false
          const Icon = item.icon

          return (
            <div key={item.id} ref={(element) => { nodeRefs.current[item.id] = element }}
              className="absolute cursor-pointer transition-all duration-700"
              style={{ transform: `translate(${position.x}px, ${position.y}px)`, zIndex: isExpanded ? 200 : position.zIndex, opacity: isExpanded ? 1 : position.opacity }}
              onClick={(event) => { event.stopPropagation(); toggleItem(item.id) }}>
              <div className={`absolute -inset-1 rounded-full ${pulseEffect[item.id] ? 'animate-pulse' : ''}`}
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)', width: item.energy * .5 + 40, height: item.energy * .5 + 40, left: -(item.energy * .25), top: -(item.energy * .25) }} />
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${isExpanded ? 'scale-150 border-white bg-white text-black shadow-lg shadow-white/30' : isRelated ? 'animate-pulse border-white bg-white/50 text-black' : 'border-white/40 bg-black text-white'}`}>
                <Icon size={16} />
              </div>
              <div className={`absolute top-12 -translate-x-[calc(50%-20px)] whitespace-nowrap text-xs font-semibold tracking-wide transition-all duration-300 ${isExpanded ? 'scale-125 text-white' : 'text-white/70'}`}>
                {item.title}
              </div>

              {isExpanded && (
                <Card className="absolute left-1/2 top-20 w-72 -translate-x-1/2 overflow-visible border-white/30 bg-black/95 text-white shadow-xl shadow-black/50 backdrop-blur-lg">
                  <div className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-white/50" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={`px-2 text-[10px] ${getStatusStyles(item.status)}`}>
                        {item.status === 'completed' ? 'INTEGRADO' : item.status === 'in-progress' ? 'EM USO' : 'PLANEJADO'}
                      </Badge>
                      <span className="text-xs font-mono text-white/50">{item.date}</span>
                    </div>
                    <CardTitle className="mt-2 text-sm">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs leading-relaxed text-white/80">
                    <p>{item.content}</p>
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center"><Zap size={11} className="mr-1" />Integração</span>
                        <span className="font-mono">{item.energy}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-gradient-to-r from-zinc-500 to-white" style={{ width: `${item.energy}%` }} />
                      </div>
                    </div>
                    {!!item.relatedIds.length && (
                      <div className="mt-4 border-t border-white/10 pt-3">
                        <div className="mb-2 flex items-center text-white/70"><Link size={11} className="mr-1" />Módulos conectados</div>
                        <div className="flex flex-wrap gap-1">
                          {item.relatedIds.map((relatedId) => (
                            <Button key={relatedId} variant="outline" size="sm" className="h-6 rounded-none px-2 py-0 text-[10px] text-white/80"
                              onClick={(event) => { event.stopPropagation(); toggleItem(relatedId) }}>
                              {timelineData.find((candidate) => candidate.id === relatedId)?.title}<ArrowRight size={9} className="ml-1" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
