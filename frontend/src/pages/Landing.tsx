import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'motion/react'
import { 
  ArrowRight, ShieldCheck, Cpu, Activity, 
  Terminal, ShieldAlert
} from 'lucide-react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { aplicarSeo } from '../lib/seo'
import Aurora from '../components/ui/aurora'
import ScrollRevealSection from '../components/ui/scroll-reveal-section'
import ScrollStack, { ScrollStackItem } from '../components/ui/scroll-stack'
import TiltedCard from '../components/ui/tilted-card'
import CountUp from '../components/ui/count-up'
import CoilArt from '../components/ui/coil-art'
import { SystemDepthScrub } from '../components/ui/system-depth-scrub'
import FoldText from '../components/ui/FoldText'
import { Marquee } from '../components/ui/marquee'
import Cursor from '../components/ui/inverted-cursor'
import BrandMark from '../components/ui/brand-mark'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

export default function LandingTeste() {
  const containerRef = useRef<HTMLDivElement>(null)
  const marqueeRef = useRef<HTMLDivElement>(null)
  const titleLinesRef = useRef<(HTMLSpanElement | null)[]>([])
  const [isMarqueeVisible, setIsMarqueeVisible] = useState(false)

  // Initialization: SEO & Lenis
  useEffect(() => {
    aplicarSeo({
      titulo: 'Maintenex | Alta Performance em CMMS',
      descricao: 'Engenharia de manutenção de alto desempenho. Controle total, zero falsos alertas.',
      caminho: '/',
      noindex: false,
    })

    const lenis = new Lenis({
      lerp: 0.075,
      wheelMultiplier: 0.9,
      touchMultiplier: 0.9,
      syncTouch: true
    })

    const tick = (time: number) => lenis.raf(time * 1000)
    const refresh = () => ScrollTrigger.refresh()
    const refreshTimers = [
      window.setTimeout(refresh, 120),
      window.setTimeout(refresh, 650),
    ]

    lenis.on('scroll', ScrollTrigger.update)
    window.addEventListener('load', refresh, { once: true })
    window.addEventListener('resize', refresh)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      refreshTimers.forEach(window.clearTimeout)
      window.removeEventListener('load', refresh)
      window.removeEventListener('resize', refresh)
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [])

  // Infinite Marquee intersection observer (pauses when offscreen)
  useEffect(() => {
    const ob = new IntersectionObserver(([entry]) => {
      setIsMarqueeVisible(entry.isIntersecting)
    }, { threshold: 0 })

    if (marqueeRef.current) ob.observe(marqueeRef.current)
    return () => ob.disconnect()
  }, [])

  // Hero Text GSAP Reveal (Lando Norris style line-by-line)
  useEffect(() => {
    const lines = titleLinesRef.current.filter(Boolean)
    if (!lines.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.to(lines, {
        y: 0,
        stagger: 0.15,
        duration: 1.2,
        ease: 'power4.out',
        delay: 0.2
      })
    })

    return () => ctx.revert()
  }, [])

  // Parallax constraints for Hero UI
  const { scrollY } = useScroll()
  const yDashboard = useTransform(scrollY, [0, 800], [0, 150])
  const yCoil = useTransform(scrollY, [0, 800], [0, -80])

  return (
    <div ref={containerRef} className="lp-teste">
      <Cursor size={42} />
      <header className="lp-teste-nav-shell">
        <Link to="/" className="lp-teste-nav-brand" aria-label="Maintenex, início">
          <BrandMark className="lp-teste-brand-mark" />
          <FoldText text="Maintenex" />
        </Link>

        <nav className="lp-teste-nav-links" aria-label="Navegação da landing page">
          <a href="#recursos">Recursos</a>
          <a href="#guia-operacional">Como funciona</a>
          <a href="#guia-operacional">Acessos</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>

        <div className="lp-teste-nav-actions">
          <Link to="/login" className="lp-teste-nav-login">Entrar</Link>
          <Link to="/login?modo=cadastrar" className="lp-teste-nav-signup">Criar conta</Link>
        </div>
      </header>
      
      {/* 1. HERO SECTION */}
      <section id="inicio" className="relative min-h-[100svh] flex flex-col justify-center items-center overflow-hidden px-4 py-20 pb-32">
        <div className="lp-teste-aurora-wrap">
          {/* Custom Aurora: Deep purple, Cyan, Neon Lime */}
          <Aurora 
            colorStops={['#39c5cf', '#a371f7', '#ccff00']} 
            speed={0.5} 
            amplitude={1.2} 
            blend={0.6} 
          />
        </div>

        {/* Global Noise Overlay */}
        <div 
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}
        />

        <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row items-center gap-16">
          
          <div className="flex-1 text-center lg:text-left flex flex-col gap-6">
            {/* SplitText Style Accessibility Pattern */}
            <h1 className="sr-only">Controle Absoluto. Máxima Eficiência.</h1>
            
            <h1 aria-hidden="true" className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] uppercase relative">
              <span className="lp-teste-text-mask py-2">
                <span className="lp-teste-text-reveal text-white block" ref={(el) => { titleLinesRef.current[0] = el }}>Controle</span>
              </span>
              <br />
              <span className="lp-teste-text-mask py-2">
                <span className="lp-teste-text-reveal text-white block" ref={(el) => { titleLinesRef.current[1] = el }}>Absoluto.</span>
              </span>
              <br />
              <span className="lp-teste-text-mask py-2">
                <span className="lp-teste-text-reveal text-[var(--primaria)] block" ref={(el) => { titleLinesRef.current[2] = el }}>Máxima Eficiência.</span>
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-[var(--lp-teste-texto-suave)] max-w-lg mt-2 mx-auto lg:mx-0 relative z-10">
              Equipamentos, checklists, estoque e pendências conectados em um só lugar. Sua equipe executa, o Maintenex organiza e a gestão acompanha.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 relative z-10">
              <Link to="/app" className="group relative overflow-hidden bg-[var(--primaria)] text-[var(--primaria-texto)] px-8 py-4 rounded-lg font-bold text-lg hover:scale-105 active:scale-95 transition-all w-full sm:w-auto text-center flex items-center justify-center gap-2 uppercase tracking-wide">
                Iniciar Sessão <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md relative">
            <motion.div style={{ y: yDashboard }} className="relative z-10">
              <TiltedCard>
                <div className="lp-teste-glass-card p-6 min-h-[420px] flex flex-col gap-6 text-white overflow-hidden shadow-2xl relative">
                  {/* Fake Editor/Terminal Header */}
                  <div className="flex items-center gap-2 border-b border-[var(--lp-teste-borda)] pb-4 mb-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <div className="ml-auto font-mono text-[10px] text-[var(--lp-teste-texto-suave)]">maintenex:~</div>
                  </div>

                  <div>
                    <div className="text-sm font-mono text-[var(--lp-teste-texto-suave)] mb-1">Resumo da operação</div>
                    <div className="text-4xl font-bold flex items-baseline gap-1">
                      <span className="text-[var(--primaria)]"><CountUp to={99} /></span>
                      <span className="text-xl">.9%</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { k: 'Equipamentos ativos', v: '24', c: 'text-green-400' },
                      { k: 'Pendências em aberto', v: '04', c: 'text-yellow-400' },
                      { k: 'Alerta de estoque baixo', v: '03', c: 'text-blue-400' }
                    ].map(i => (
                      <div key={i.k} className="flex justify-between items-center text-sm font-mono border-b border-white/5 pb-2">
                        <span className="text-[var(--lp-teste-texto-suave)]">{i.k}</span>
                        <span className={i.c}>{i.v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="lp-teste-card-arrow" aria-hidden="true">
                    <Terminal className="text-[var(--lp-teste-texto-suave)]" />
                  </div>
                </div>
              </TiltedCard>
            </motion.div>
            
            <motion.div style={{ y: yCoil }} className="absolute -top-12 -right-12 z-0 opacity-80 blur-[2px] pointer-events-none scale-75">
              <CoilArt corA="#39c5cf" corB="#a371f7" corC="#ccff00" />
            </motion.div>
          </div>
        </div>

      </section>

      {/* 2. DIAGONAL TICKER STRIP (Caution Tape Pattern) */}
      <div id="recursos" className="lp-teste-ticker-section relative py-12 overflow-hidden bg-transparent z-20 scroll-mt-28">
        <div ref={marqueeRef} className="lp-teste-marquee-container shadow-2xl">
          <div className="lp-teste-marquee-track" data-animating={isMarqueeVisible}>
            {/* Duplicated content for infinite loop */}
            {[1,2,3,4].map(idx => (
              <span key={idx} className="flex items-center px-8 text-[var(--primaria-texto)]">
                CONTROLE DE ESTOQUE <span className="mx-6">·</span> 
                INDICADORES OPERACIONAIS <span className="mx-6">·</span>
                GESTÃO MULTIEMPRESA <span className="mx-6">·</span>
                MÉTRICAS EM TEMPO REAL <span className="mx-6">·</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 3. STICKY / SCROLL-STACK OPERATIONAL SEQUENCE */}
      <section id="fluxo-operacional" className="lp-como-stack lp-teste-operational-stack relative z-10 scroll-mt-28">
        <div className="lp-container">
          <div className="lp-teste-stack-head">
            <h2>DA EXECUÇÃO AO CONTROLE</h2>
            <p>
             Do registro das atividades ao acompanhamento dos indicadores. Cada etapa da manutenção permanece organizada e acessível em um único sistema.
            </p>
          </div>

          <ScrollStack useWindowScroll itemDistance={150} itemStackDistance={42} stackPosition="18%" scaleEndPosition="8%" baseScale={0.9} itemScale={0.035} rotationAmount={0}>
            {[
              {
                id: 'diag',
                phase: 'Fase 01',
                label: 'Diagnóstico preditivo',
                icon: <Activity className="w-9 h-9 text-[#39c5cf]" />,
                title: 'Diagnóstico',
                desc: 'checklists, ocorrências e atividades vinculadas aos equipamentos e setores da operação.',
                metric: '01',
                metricLabel: 'FLUXO CENTRALIZADO',
                accent: '#39c5cf',
              },
              {
                id: 'plan',
                phase: 'Fase 02',
                label: 'Planejamento de recursos',
                icon: <Cpu className="w-9 h-9 text-[var(--primaria)]" />,
                title: 'Planejamento',
                desc: 'Peças, ferramentas e técnicos entram em rota com base em disponibilidade, prioridade e impacto operacional.',
                metric: '98%',
                metricLabel: 'aderência ao plano',
                accent: '#ccff00',
              },
              {
                id: 'exec',
                phase: 'Fase 03',
                label: 'ACOMPANHAMENTO GERENCIAL',
                icon: <ShieldAlert className="w-9 h-9 text-[#a371f7]" />,
                title: 'Controle',
                desc: 'Indicadores e históricos transformam os registros da operação em uma visão clara para acompanhar prioridades e apoiar decisões.',
                metric: '24/7',
                metricLabel: 'HISTÓRICO RASTREÁVEL',
                accent: '#a371f7',
              },
            ].map((item, index) => (
              <ScrollStackItem key={item.id} itemClassName={`lp-teste-step-card step-${index + 1}`}>
                <div className="lp-teste-step-glow" style={{ background: item.accent }} />
                <div className="lp-teste-step-grid" />
                <div className="lp-teste-step-top">
                  <span>{item.phase}</span>
                  <span>{item.label}</span>
                </div>
                <div className="lp-teste-step-body">
                  <div className="lp-teste-step-icon" style={{ '--step-accent': item.accent } as CSSProperties}>
                    {item.icon}
                    <svg viewBox="0 0 100 100" className="lp-teste-badge">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 7" />
                    </svg>
                  </div>
                  <div className="lp-teste-step-copy">
                    <span className="lp-teste-step-number">{String(index + 1).padStart(2, '0')}</span>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                  <div className="lp-teste-step-metric">
                    <strong>{item.metric}</strong>
                    <span>{item.metricLabel}</span>
                  </div>
                </div>
                <div className="lp-teste-step-bottom">
                  <span>Fluxo validado</span>
                  <svg width="150" height="18" viewBox="0 0 150 18" aria-hidden="true">
                    <line x1="0" y1="9" x2="138" y2="9" stroke="currentColor" strokeWidth="2" className="lp-teste-marching-ants" />
                    <circle cx="142" cy="9" r="5" fill="currentColor" />
                  </svg>
                </div>
              </ScrollStackItem>
            ))}
          </ScrollStack>
        </div>
      </section>

      {/* 4. CINEMATIC SYSTEM DEPTH SCRUB */}
      <SystemDepthScrub />

      {/* 5. HOW IT WORKS + ACCESS LEVELS */}
      <section id="guia-operacional" className="lp-unified-guide scroll-mt-20" aria-labelledby="lp-unified-guide-title">
        <div className="lp-unified-guide-inner">
          <header className="lp-unified-guide-head">
            <h2 id="lp-unified-guide-title">Da configuração à execução</h2>
            <p>Entenda o fluxo do Maintenex e quem participa de cada etapa da operação.</p>
          </header>

          <div className="lp-unified-guide-grid">
            <article className="lp-guide-panel lp-guide-panel--flow">
              <div className="lp-guide-panel-head">
                <h3>Três passos para começar</h3>
              </div>
              <ol className="lp-guide-steps">
                {[
                  ['Configure a estrutura', 'Cadastre empresas, cidades, setores e os responsáveis pela operação.'],
                  ['Organize os ativos', 'Inclua equipamentos, estoque, checklists e atividades de manutenção.'],
                  ['Execute e acompanhe', 'Registre o trabalho em campo e acompanhe pendências e indicadores.'],
                ].map(([title, detail], index) => (
                  <li key={title}>
                    <b>{String(index + 1).padStart(2, '0')}</b>
                    <div><strong>{title}</strong><p>{detail}</p></div>
                  </li>
                ))}
              </ol>
            </article>

            <article className="lp-guide-panel lp-guide-panel--access">
              <div className="lp-guide-panel-head">
                <h3>Três níveis de acesso</h3>
              </div>
              <div className="lp-guide-access-list">
                {[
                  ['Administração da plataforma', 'Cria e acompanha as empresas com uma visão consolidada do ambiente.'],
                  ['Responsável pela empresa', 'Convida funcionários, define papéis e configura a estrutura operacional.'],
                  ['Equipe', 'Gestores, técnicos e leitores acessam somente o necessário para sua função.'],
                ].map(([title, detail], index) => (
                  <div className="lp-guide-access-item" key={title}>
                    <i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i>
                    <div><strong>{title}</strong><p>{detail}</p></div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 6. TECHNOLOGY MARQUEE */}
      <section className="lp-tech-stack" aria-label="Tecnologias utilizadas no Maintenex">
        <Marquee speed={42}>
          {[
            ['react', 'React'],
            ['typescript', 'TypeScript'],
            ['vite', 'Vite'],
            ['tailwind', 'tailwindcss'],
            ['supabase', 'supabase'],
            ['vercel', 'Vercel'],
            ['gsap', 'GSAP'],
            ['motion', 'Motion'],
          ].map(([slug, name]) => (
            <div className={`lp-tech-logo lp-tech-logo--${slug}`} key={slug}>
              {slug !== 'gsap' && (
                <span className="lp-tech-logo-mark" aria-hidden="true">
                  {slug === 'typescript' && <b>TS</b>}
                </span>
              )}
              <strong>{name}</strong>
            </div>
          ))}
        </Marquee>
      </section>

      {/* 6. FREQUENTLY ASKED QUESTIONS */}
      <section id="duvidas" className="lp-faq scroll-mt-20" aria-labelledby="lp-faq-title">
        <div className="lp-faq-inner">
          <div className="lp-faq-layout">
            <header className="lp-faq-head">
              <h2 id="lp-faq-title">Perguntas frequentes</h2>
              <p>O essencial sobre funcionamento, acessos e dados no Maintenex.</p>
            </header>

            <div className="lp-faq-list">
              {[
                ['O que é o Maintenex?', 'O Maintenex é um sistema de gestão da manutenção que centraliza equipamentos, checklists, pendências, estoque e indicadores operacionais em um único ambiente.'],
                ['Como funcionam os níveis de acesso?', 'Cada usuário recebe permissões de acordo com sua função. Técnicos, gestores e administradores visualizam e alteram somente os recursos necessários para o trabalho.'],
                ['Uma empresa pode se cadastrar sozinha?', 'Sim. A empresa pode criar sua conta, configurar a operação e convidar sua equipe sem depender de uma implantação complexa.'],
                ['O estoque é atualizado automaticamente?', 'As movimentações registradas no sistema atualizam as quantidades e o histórico dos itens, permitindo acompanhar entradas, saídas e alertas de estoque baixo.'],
                ['É possível exportar os dados?', 'Sim. Relatórios e registros podem ser consultados e exportados conforme os recursos e as permissões disponíveis para o usuário.'],
                ['Os dados de cada empresa ficam separados?', 'Sim. O Maintenex mantém os dados de cada empresa isolados e aplica controles para que usuários autorizados visualizem apenas a operação correspondente.'],
              ].map(([question, answer]) => (
                <details className="lp-faq-item" key={question}>
                  <summary><span>{question}</span><i aria-hidden="true" /></summary>
                  <div className="lp-faq-answer"><p>{answer}</p></div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FINAL / CTA SECTION */}
      <ScrollRevealSection className="lp-teste-final-cta">
        <div className="lp-final-card-new">
          <div className="lp-final-orb lp-final-orb--one" aria-hidden="true" />
          <div className="lp-final-orb lp-final-orb--two" aria-hidden="true" />
          <div className="lp-final-card-copy">
            <span>Seu primeiro ciclo começa aqui</span>
            <h2>Comece pelo que já está parado.</h2>
            <p>Organize os equipamentos críticos, distribua as primeiras atividades e transforme manutenção acumulada em uma rotina visível.</p>
            <div className="lp-final-actions">
              <Link to="/login?modo=cadastrar">Criar conta da empresa <ArrowRight /></Link>
              <Link to="/login">Já tenho uma conta</Link>
            </div>
          </div>

          <div className="lp-final-preview" aria-label="Exemplo de acompanhamento da operação">
            <div className="lp-final-preview-top"><span>Operação de hoje</span><small>Tempo real</small></div>
            <div className="lp-final-preview-metric"><div><small>Atividades em andamento</small><b>+4 concluídas esta semana</b></div><strong>12</strong></div>
            <div className="lp-final-preview-progress"><i /></div>
            {[
              ['Inspeção da bomba 04', 'Preventiva · Setor norte', 'Hoje'],
              ['Correia do compressor', 'Alta prioridade · Oficina', '14:30'],
              ['Checklist do gerador', 'Concluído por Rafael', 'Feito'],
            ].map(([title, detail, status], index) => (
              <div className="lp-final-preview-row" key={title}>
                <span className={`status-${index + 1}`}><ShieldCheck /></span>
                <div><strong>{title}</strong><small>{detail}</small></div>
                <em>{status}</em>
              </div>
            ))}
          </div>

          <div className="lp-final-benefits">
            <div><ShieldCheck /><span><strong>Configuração simples</strong><small>Comece sem implantação demorada</small></span></div>
            <div><Cpu /><span><strong>Equipe no mesmo fluxo</strong><small>Papéis e responsabilidades claros</small></span></div>
            <div><Activity /><span><strong>Resultado visível</strong><small>Acompanhe a evolução desde o primeiro dia</small></span></div>
          </div>
        </div>
      </ScrollRevealSection>

      <footer className="lp-teste-footer">
        <div className="lp-teste-footer-inner">
          <Link to="/" className="lp-teste-footer-brand" aria-label="Maintenex, início">
            <BrandMark className="lp-teste-brand-mark" />
            <span>Maintenex</span>
          </Link>
          <p>Gestão da manutenção para equipes de campo e almoxarifado.</p>
          <nav aria-label="Navegação do rodapé">
            <a href="#recursos">Recursos</a>
            <a href="#guia-operacional">Como funciona</a>
            <a href="#duvidas">Dúvidas</a>
            <Link to="/login">Entrar</Link>
          </nav>
        </div>
      </footer>

    </div>
  )
}
