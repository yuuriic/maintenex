"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Binary,
  Database,
  Eye,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Network,
  ShieldCheck,
  Workflow,
} from "lucide-react";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const layers = [
  {
    eyebrow: "Camada 01",
    title: "Aplicação operacional",
    copy: "Telas, checklists, estoque e histórico entram no mesmo fluxo visual.",
    icon: Workflow,
    accent: "#39c5cf",
  },
  {
    eyebrow: "Camada 02",
    title: "Banco de dados",
    copy: "Registros ficam conectados, rastreáveis e prontos para auditoria.",
    icon: Database,
    accent: "#ccff00",
  },
  {
    eyebrow: "Camada 03",
    title: "Cybersegurança",
    copy: "Permissões, sessões e acessos protegidos antes da operação avançar.",
    icon: LockKeyhole,
    accent: "#a371f7",
  },
];

const finalCards = [
  {
    title: "Ver Dashboard",
    detail: "Indicadores, pendências e operação em tempo real.",
    to: "/app",
    icon: Eye,
    accent: "#39c5cf",
  },
  {
    title: "Auditar Dados",
    detail: "Histórico de checklists, estoque e equipamentos.",
    to: "/app/relatorios",
    icon: Database,
    accent: "#ccff00",
  },
  {
    title: "Controlar Acesso",
    detail: "Multiempresa, usuário e trilha de decisões.",
    to: "/app/configuracoes",
    icon: KeyRound,
    accent: "#a371f7",
  },
];

export function SystemDepthScrub() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const tunnelRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const darknessRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      gsap.set(bgRef.current, { opacity: 0 });
      gsap.set(orbRef.current, { scale: 2.75, xPercent: 0, rotate: 0, opacity: 0 });
      gsap.set(tunnelRef.current, { scale: 0.96, z: 0, opacity: 0, rotate: -4 });
      gsap.set(viewportRef.current, { scale: 0.9, y: 42, opacity: 0, rotateX: 4 });
      gsap.set(finalRef.current, { scale: 0.94, y: 38, opacity: 0, pointerEvents: "none", transformOrigin: "50% 50%" });
      gsap.set(layerRefs.current, { opacity: 0, y: 34, scale: 0.92 });
      gsap.set(headlineRef.current, { opacity: 0, y: 38, scale: 0.98 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 2.4,
          invalidateOnRefresh: true,
        },
      });

      tl.to(bgRef.current, { opacity: 1, ease: "none", duration: 0.4 }, 0);
      tl.to(tunnelRef.current, { scale: 1.08, rotate: 20, opacity: 0.42, ease: "sine.out", duration: 0.52 }, 0.02);
      tl.to(orbRef.current, { scale: 2.35, opacity: 0.6, rotate: 78, ease: "sine.out", duration: 0.52 }, 0.02);
      tl.to(headlineRef.current, { y: 0, opacity: 1, scale: 1, ease: "power3.out", duration: 0.28 }, 0.04);
      tl.to(headlineRef.current, { y: -22, opacity: 0, scale: 0.98, ease: "sine.inOut", duration: 0.28 }, 0.5);
      tl.to(darknessRef.current, { opacity: 0.16, ease: "none", duration: 0.34 }, 0.5);
      tl.to(orbRef.current, { scale: 1.42, opacity: 0.6, rotate: 152, ease: "sine.inOut", duration: 0.38 }, 0.54);
      tl.to(tunnelRef.current, { scale: 1.26, rotate: 48, opacity: 0.52, ease: "sine.inOut", duration: 0.38 }, 0.54);
      tl.to(viewportRef.current, { opacity: 1, y: 0, scale: 1, rotateX: 0, ease: "power3.out", duration: 0.34 }, 0.62);

      layerRefs.current.forEach((layer, index) => {
        const at = 0.9 + index * 0.4;
        tl.to(layer, { opacity: 1, y: 0, scale: 1, ease: "power3.out", duration: 0.26 }, at);
        if (index < layerRefs.current.length - 1) {
          tl.to(layer, { opacity: 0, y: -16, scale: 0.98, ease: "sine.inOut", duration: 0.24 }, at + 0.34);
        }
      });

      tl.to(layerRefs.current, { opacity: 0, y: -28, scale: 0.96, ease: "sine.inOut", duration: 0.26 }, 1.95);
      tl.to(viewportRef.current, { scale: 0.9, y: 0, opacity: 0, ease: "sine.inOut", duration: 0.28 }, 2.0);
      tl.to(tunnelRef.current, { scale: 1.48, rotate: 102, opacity: 0.16, ease: "sine.inOut", duration: 0.38 }, 2.0);
      tl.to(orbRef.current, { scale: 0.95, xPercent: 0, opacity: 0.36, rotate: 250, ease: "sine.inOut", duration: 0.42 }, 2.0);
      tl.to(darknessRef.current, { opacity: 0.5, ease: "none", duration: 0.34 }, 2.04);
      tl.to(finalRef.current, { scale: 1, y: 0, opacity: 1, pointerEvents: "auto", ease: "power3.out", duration: 0.34 }, 2.16);
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="nucleo-operacional" ref={sectionRef} className="lp-depth-scrub scroll-mt-28" aria-labelledby="lp-depth-title">
      <div ref={stickyRef} className="lp-depth-sticky">
        <div ref={bgRef} className="lp-depth-bg" aria-hidden="true" />
        <div ref={tunnelRef} className="lp-depth-tunnel" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} style={{ "--ring": index } as CSSProperties} />
          ))}
        </div>
        <div ref={orbRef} className="lp-depth-orb" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div ref={darknessRef} className="lp-depth-darkness" aria-hidden="true" />

        <div ref={headlineRef} className="lp-depth-headline">
          <h2 id="lp-depth-title">Entre no núcleo da operação</h2>
          <p>
            Depois do diagnóstico, planejamento e controle, o fluxo aprofunda: interface,
            dados e segurança convergem em uma camada escura, rastreável e clicável.
          </p>
        </div>

        <div ref={viewportRef} className="lp-depth-viewport" aria-hidden="true">
          <div className="lp-depth-browser-top">
            <span />
            <span />
            <span />
            <strong>maintenex.core</strong>
          </div>
          <div className="lp-depth-console">
            <div className="lp-depth-console-main">
              <div className="lp-depth-gridline" />
              <HardDrive className="lp-depth-watermark" />
              <div className="lp-depth-status-row">
                <span>SYS</span>
                <b>operational-sync</b>
                <em>encrypted</em>
              </div>
              <div className="lp-depth-pulse-map">
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </div>

        <div className="lp-depth-layers">
          {layers.map((layer, index) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.title}
                ref={(el) => { layerRefs.current[index] = el }}
                className="lp-depth-layer-card"
                style={{ "--depth-accent": layer.accent } as CSSProperties}
              >
                <div className="lp-depth-layer-icon"><Icon size={28} /></div>
                <span>{layer.eyebrow}</span>
                <h3>{layer.title}</h3>
                <p>{layer.copy}</p>
              </div>
            );
          })}
        </div>

        <div ref={finalRef} className="lp-depth-final">
          <div className="lp-depth-final-copy">
            <span className="lp-teste-section-kicker">Núcleo estabilizado</span>
            <h3>Agora dá para clicar e explorar por dentro.</h3>
          </div>
          <div className="lp-depth-final-orbit" aria-hidden="true">
            <Network size={34} />
            <ShieldCheck size={24} />
            <Binary size={24} />
          </div>
          <div className="lp-depth-final-cards">
            {finalCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  to={card.to}
                  className="lp-depth-final-card"
                  style={{ "--depth-accent": card.accent } as CSSProperties}
                >
                  <Icon size={24} />
                  <span>{card.title}</span>
                  <small>{card.detail}</small>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
