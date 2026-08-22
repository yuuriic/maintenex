import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, MotionConfig, useScroll, useTransform } from 'motion/react'
import {
  ArrowRight, BarChart3, Boxes, Building2, CheckCircle2, ClipboardCheck,
  Printer, ShieldCheck, TriangleAlert, Users,
} from 'lucide-react'
import { aplicarJsonLd, aplicarSeo, SITE_URL } from '../lib/seo'
import RadialOrbitalTimeline, { type TimelineItem } from '../components/ui/radial-orbital-timeline'
import TiltedCard from '../components/ui/tilted-card'
import ScrollRevealSection from '../components/ui/scroll-reveal-section'
import CountUp from '../components/ui/count-up'
import CoilArt from '../components/ui/coil-art'
import ScrollStack, { ScrollStackItem } from '../components/ui/scroll-stack'
import Aurora from '../components/ui/aurora'

const MotionLink = motion.create(Link)

const recursos = [
  {
    icone: ClipboardCheck,
    titulo: 'Checklists preventivos e corretivos',
    texto: 'Rotinas por equipamento com itens de inspeção, responsável, prazo e histórico de execução completo.',
  },
  {
    icone: Boxes,
    titulo: 'Estoque com saldo em tempo real',
    texto: 'Entradas, saídas e ajustes atualizam o saldo na hora. Alerta de material abaixo do estoque mínimo.',
  },
  {
    icone: TriangleAlert,
    titulo: 'Pendências com SLA',
    texto: 'Quadro por status com prioridade, responsável e tempo médio entre abertura e resolução.',
  },
  {
    icone: Printer,
    titulo: 'Cadastro de equipamentos',
    texto: 'Código, série, setor, localização, contador e datas de manutenção — tudo em uma ficha só.',
  },
  {
    icone: BarChart3,
    titulo: 'Relatórios e exportação',
    texto: 'Consumo por período, ranking de equipamentos críticos e exportação em CSV para auditoria.',
  },
  {
    icone: Users,
    titulo: 'Equipe com papéis de acesso',
    texto: 'Responsável da empresa convida a equipe e define quem administra, executa ou apenas consulta.',
  },
]

const recursosOrbitais: TimelineItem[] = recursos.map((recurso, index) => ({
  id: index + 1,
  title: recurso.titulo,
  date: `Módulo ${String(index + 1).padStart(2, '0')}`,
  content: recurso.texto,
  category: 'Manutenção',
  icon: recurso.icone,
  relatedIds: [((index + recursos.length - 1) % recursos.length) + 1, ((index + 1) % recursos.length) + 1],
  status: index < 3 ? 'completed' : index < 5 ? 'in-progress' : 'pending',
  energy: 100 - index * 12,
}))

const passos = [
  { titulo: 'Cadastre a empresa', texto: 'O primeiro usuário vira o responsável e já pode convidar a equipe por e-mail.' },
  { titulo: 'Importe o parque', texto: 'Cadastre cidades, setores e equipamentos — ou comece pelo que já está em manutenção.' },
  { titulo: 'Rode a operação', texto: 'Checklists no campo, baixa de material no almoxarifado e pendências resolvidas com prazo.' },
]

const perguntas = [
  {
    pergunta: 'O que é o Maintenex?',
    resposta:
      'O Maintenex é um sistema de gestão de manutenção (CMMS) em nuvem que reúne checklists preventivos, controle de estoque de peças e acompanhamento de pendências com SLA em um painel único, em português.',
  },
  {
    pergunta: 'Como funcionam os níveis de acesso?',
    resposta:
      'São três níveis: a administração da plataforma, o responsável pela empresa e os usuários da equipe. O responsável convida funcionários por e-mail e define o papel de cada um — gestor, técnico ou leitor.',
  },
  {
    pergunta: 'Uma empresa pode se cadastrar sozinha?',
    resposta:
      'Sim. A empresa pode ser cadastrada pela administração da plataforma ou fazer o próprio cadastro. No auto-cadastro, o primeiro usuário se torna o responsável principal da empresa.',
  },
  {
    pergunta: 'O estoque é atualizado automaticamente?',
    resposta:
      'Sim. Cada movimentação de entrada, saída ou ajuste recalcula o saldo do material na cidade correspondente no momento do registro, sem fechamento manual.',
  },
  {
    pergunta: 'Dá para exportar os dados?',
    resposta:
      'Sim. Os relatórios de checklists, equipamentos e estoque podem ser exportados em CSV, formato aceito por Excel, Google Sheets e ferramentas de BI.',
  },
  {
    pergunta: 'Os dados de cada empresa ficam separados?',
    resposta:
      'Sim. Cada empresa é um espaço isolado: as regras de acesso do banco garantem que um usuário só enxergue os registros da empresa à qual pertence.',
  },
]

const heroVariantes = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
}
const itemVariante = {
  oculto: { opacity: 0, y: 22 },
  visivel: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function Landing() {
  const { scrollY } = useScroll()
  const glowY = useTransform(scrollY, [0, 700], [0, 160])

  useEffect(() => {
    aplicarSeo({
      titulo: 'Maintenex — Software de gestão de manutenção (checklists, estoque e pendências)',
      descricao:
        'Sistema de gestão de manutenção com checklists preventivos, controle de estoque de peças e pendências com SLA em um painel único. Multiempresa, com acesso por papéis.',
      caminho: '/',
    })

    aplicarJsonLd('ld-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: perguntas.map((p) => ({
        '@type': 'Question',
        name: p.pergunta,
        acceptedAnswer: { '@type': 'Answer', text: p.resposta },
      })),
    })

    aplicarJsonLd('ld-howto', {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Como começar a usar o Maintenex',
      inLanguage: 'pt-BR',
      step: passos.map((p, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: p.titulo,
        text: p.texto,
        url: `${SITE_URL}/#como-funciona`,
      })),
    })
  }, [])

  return (
    <div className="lp">
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>

      <header className="lp-topo">
        <div className="lp-container lp-nav">
          <Link to="/" className="lp-marca" aria-label="Maintenex, página inicial">
            <span className="brand-mark">M</span>
            <b>Maintenex</b>
          </Link>
          <nav aria-label="Navegação principal">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#niveis">Acessos</a>
            <a href="#perguntas">Dúvidas</a>
          </nav>
          <div className="lp-nav-acoes">
            <Link className="btn" to="/login">Entrar</Link>
            <Link className="btn primario" to="/login?modo=cadastrar">Criar conta<ArrowRight size={16} /></Link>
          </div>
        </div>
      </header>

      <main id="conteudo">
        <div className="lp-intro-gradiente">
        <section className="lp-hero">
          <motion.div className="lp-aurora-hero" style={{ y: glowY }} aria-hidden>
            <Aurora colorStops={["#71d326", "#a58cf0", "#39758d"]} blend={0.58} amplitude={1.08} speed={0.62} />
          </motion.div>
          <div className="lp-container">
            <MotionConfig reducedMotion="user">
              <motion.div className="lp-hero-conteudo" variants={heroVariantes} initial="oculto" animate="visivel">
                <motion.span variants={itemVariante} className="lp-selo">
                  <ShieldCheck size={14} />Gestão de manutenção em português
                </motion.span>
                <motion.h1 variants={itemVariante}>
                  Manutenção <span className="lp-destaque-texto">sob controle</span>, do checklist ao estoque.
                </motion.h1>
                <motion.p variants={itemVariante} className="lp-lead">
                  O Maintenex reúne checklists preventivos, controle de peças e pendências com SLA
                  em um painel único. Sua equipe registra no campo, o almoxarifado dá baixa e a
                  gestão acompanha por indicadores — sem planilha paralela.
                </motion.p>
                <motion.div variants={itemVariante} className="lp-cta">
                  <MotionLink
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="btn primario grande" to="/login?modo=cadastrar"
                  >
                    Criar conta da empresa<ArrowRight size={17} />
                  </MotionLink>
                  <MotionLink whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn grande" to="/login">
                    Já tenho acesso
                  </MotionLink>
                </motion.div>
                <motion.ul variants={itemVariante} className="lp-bullets">
                  <li><CheckCircle2 size={16} />Cadastro da empresa em minutos</li>
                  <li><CheckCircle2 size={16} />Dados isolados por empresa</li>
                  <li><CheckCircle2 size={16} />Exportação em CSV</li>
                </motion.ul>

                <motion.div variants={itemVariante} className="lp-hero-visual">
                  <TiltedCard rotateAmplitude={11} scaleOnHover={1.03}>
                    <div className="lp-mock" aria-hidden>
                      <div className="lp-mock-topo"><span /><span /><span /></div>
                      <div className="lp-mock-corpo">
                        <div className="lp-mock-cards">
                          <div><small>Preventivas</small><b><CountUp to={128} /></b></div>
                          <div><small>Razão P/C</small><b><CountUp to={3.2} decimals={1} /></b></div>
                          <div><small>Pendências</small><b><CountUp to={7} /></b></div>
                          <div><small>SLA médio</small><b><CountUp to={1.8} decimals={1} suffix=" d" /></b></div>
                        </div>
                        <div className="lp-mock-chart">
                          {[38, 62, 45, 78, 56, 88].map((h, i) => (
                            <span key={i} style={{ height: `${h}%` }} />
                          ))}
                        </div>
                        <div className="lp-mock-linhas">
                          {['Limpeza geral · EQP-PR-001', 'Troca de suprimento · EQP-PR-004', 'Revisão mecânica · EQP-SC-002'].map((l) => (
                            <div key={l}><CheckCircle2 size={13} />{l}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TiltedCard>
                </motion.div>
              </motion.div>
            </MotionConfig>
          </div>
        </section>

        <ScrollRevealSection className="lp-stats" staggerSelector=".lp-stats-grid > div">
          <div className="lp-container lp-stats-grid">
            <div><b><CountUp to={6} /></b><span>Módulos integrados em um painel</span></div>
            <div><b><CountUp to={3} /></b><span>Níveis de acesso configuráveis</span></div>
            <div><b><CountUp to={100} suffix="%" /></b><span>Dados isolados por empresa</span></div>
          </div>
        </ScrollRevealSection>

        <ScrollRevealSection id="recursos" className="lp-secao">
          <div className="lp-container">
            <div className="lp-eyebrow-barra"><span>N°01</span><span>Recursos</span><span>N°01</span></div>
            <header className="lp-secao-head lp-secao-head-centralizado">
              <h2>Tudo que a manutenção precisa, em um lugar</h2>
              <p>Seis módulos que conversam entre si — o checklist consome material, o material baixa do estoque, a falha vira pendência. Clique em cada um para explorar.</p>
            </header>
            <div className="lp-pill-linha">
              <span className="lp-pill lima">Checklists</span>
              <span className="lp-pill claro">Estoque</span>
              <span className="lp-pill lavanda">Pendências</span>
              <span className="lp-pill escuro">Equipamentos</span>
              <span className="lp-pill claro">Relatórios</span>
              <span className="lp-pill lima">Equipe</span>
            </div>
            <div className="lp-recursos-orbital">
              <RadialOrbitalTimeline timelineData={recursosOrbitais} />
            </div>
            <div className="lp-grid-3 lp-recursos-mobile">
              {recursos.map((r) => (
                <article key={r.titulo} className="lp-card">
                  <span className="lp-card-icone"><r.icone size={22} strokeWidth={1.5} /></span>
                  <h3>{r.titulo}</h3>
                  <p>{r.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </ScrollRevealSection>
        </div>

        <section id="como-funciona" className="lp-secao alt lp-como-stack">
          <div className="lp-container">
            <div className="lp-eyebrow-barra"><span>N°02</span><span>Como funciona</span><span>N°02</span></div>
            <header className="lp-secao-head lp-como-head">
              <h2>Como funciona</h2>
              <p>Três passos entre criar a conta e ter o primeiro indicador na tela. Role para montar sua operação.</p>
            </header>
            <ScrollStack useWindowScroll itemDistance={150} itemStackDistance={26} stackPosition="18%" scaleEndPosition="8%" baseScale={0.9} itemScale={0.035} rotationAmount={0.25}>
              {passos.map((p, i) => (
                <ScrollStackItem key={p.titulo} itemClassName={`lp-passo-stack passo-${i + 1}`}>
                  <div className="lp-passo-stack-topo"><span>Etapa {String(i + 1).padStart(2, '0')}</span><span>{i === 0 ? 'Estrutura' : i === 1 ? 'Inventário' : 'Operação'}</span></div>
                  <div className="lp-passo-stack-corpo">
                    <span className="lp-passo-stack-icone">
                      {i === 0 ? <Building2 size={30} strokeWidth={1.5} /> : i === 1 ? <Boxes size={30} strokeWidth={1.5} /> : <ClipboardCheck size={30} strokeWidth={1.5} />}
                    </span>
                    <div><span className="lp-passo-stack-num">{String(i + 1).padStart(2, '0')}</span><h3>{p.titulo}</h3><p>{p.texto}</p></div>
                  </div>
                  <div className="lp-passo-stack-rodape"><span>{i === 0 ? 'Convide sua equipe' : i === 1 ? 'Organize por setor' : 'Acompanhe em tempo real'}</span><ArrowRight size={18} /></div>
                </ScrollStackItem>
              ))}
            </ScrollStack>
          </div>
        </section>

        <ScrollRevealSection id="niveis" className="lp-secao" staggerSelector=".lp-secao-head, .lp-grid-3 .lp-card">
          <div className="lp-container">
            <div className="lp-eyebrow-barra"><span>N°03</span><span>Acessos</span><span>N°03</span></div>
            <header className="lp-secao-head">
              <h2>Três níveis de acesso</h2>
              <p>Da administração da plataforma até o técnico em campo, cada um enxerga o que precisa.</p>
            </header>
            <div className="lp-grid-3">
              <motion.article whileHover={{ y: -6 }} className="lp-card destaque">
                <span className="lp-card-icone"><Building2 size={26} strokeWidth={1.5} /></span>
                <h3>Administração da plataforma</h3>
                <p>Cria e acompanha as empresas clientes, com visão consolidada de todos os espaços.</p>
              </motion.article>
              <motion.article whileHover={{ y: -6 }} className="lp-card destaque">
                <span className="lp-card-icone"><ShieldCheck size={26} strokeWidth={1.5} /></span>
                <h3>Responsável pela empresa</h3>
                <p>E-mail principal do cliente. Convida funcionários, define papéis e configura cidades e setores.</p>
              </motion.article>
              <motion.article whileHover={{ y: -6 }} className="lp-card destaque">
                <span className="lp-card-icone"><Users size={26} strokeWidth={1.5} /></span>
                <h3>Equipe</h3>
                <p>Gestor, técnico ou leitor — cada papel com o nível de escrita adequado à função.</p>
              </motion.article>
            </div>
          </div>
        </ScrollRevealSection>

        <ScrollRevealSection id="perguntas" className="lp-secao alt" staggerSelector=".lp-secao-head, .lp-faq-lista details">
          <div className="lp-container lp-faq">
            <div className="lp-eyebrow-barra"><span>N°04</span><span>Dúvidas</span><span>N°04</span></div>
            <header className="lp-secao-head">
              <h2>Perguntas frequentes</h2>
              <p>O essencial sobre funcionamento, acessos e dados.</p>
            </header>
            <div className="lp-faq-lista">
              {perguntas.map((p) => (
                <details key={p.pergunta}>
                  <summary><h3>{p.pergunta}</h3></summary>
                  <p>{p.resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </ScrollRevealSection>

        <ScrollRevealSection className="lp-secao lp-final" staggerSelector=".lp-final-copy > *, .lp-final-painel, .lp-final-beneficios li">
          <div className="lp-container lp-final-card">
            <div className="lp-coil-final" aria-hidden>
              <CoilArt className="h-full w-full" corA="#cabdf5" corB="#8fd94b" corC="#f2ede1" />
            </div>
            <div className="lp-final-copy">
              <span className="lp-final-kicker">Seu primeiro ciclo começa aqui</span>
              <h2>Comece pelo que<br />já está parado.</h2>
              <p>Organize os equipamentos críticos, distribua as primeiras ordens e transforme manutenção acumulada em uma rotina visível.</p>
              <div className="lp-final-acoes">
                <MotionLink whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="btn primario grande" to="/login?modo=cadastrar">
                  Criar conta da empresa<ArrowRight size={17} />
                </MotionLink>
                <Link className="lp-final-link" to="/login">Já tenho uma conta</Link>
              </div>
            </div>
            <div className="lp-final-painel" aria-label="Exemplo de operação organizada no Maintenex">
              <div className="lp-final-painel-topo">
                <div><span className="lp-final-status" /> Operação de hoje</div><span>Quarta, 19 ago.</span>
              </div>
              <div className="lp-final-metrica"><span>Ordens em andamento</span><strong>12</strong><small><b>+4 concluídas</b> nesta semana</small></div>
              <div className="lp-final-progresso"><span /></div>
              <div className="lp-final-tarefas">
                <div><span className="lp-final-tarefa-icone"><ClipboardCheck size={18} /></span><p><b>Inspeção da bomba 04</b><small>Preventiva · Setor norte</small></p><em>Hoje</em></div>
                <div><span className="lp-final-tarefa-icone alerta"><TriangleAlert size={18} /></span><p><b>Correia do compressor</b><small>Alta prioridade · Oficina</small></p><em>14:30</em></div>
                <div><span className="lp-final-tarefa-icone ok"><CheckCircle2 size={18} /></span><p><b>Checklist do gerador</b><small>Concluído por Rafael</small></p><em>Feito</em></div>
              </div>
            </div>
            <ul className="lp-final-beneficios" aria-label="Benefícios para começar">
              <li><CheckCircle2 size={18} /><span><b>Configuração simples</b><small>Comece sem implantação demorada</small></span></li>
              <li><Users size={18} /><span><b>Equipe no mesmo fluxo</b><small>Papéis e responsabilidades claros</small></span></li>
              <li><BarChart3 size={18} /><span><b>Resultado visível</b><small>Acompanhe a evolução desde o dia um</small></span></li>
            </ul>
          </div>
        </ScrollRevealSection>
      </main>

      <footer className="lp-rodape">
        <div className="lp-container">
          <div className="lp-marca"><span className="brand-mark">M</span><b>Maintenex</b></div>
          <p>Gestão de manutenção para equipes de campo e almoxarifado.</p>
          <nav aria-label="Rodapé">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#perguntas">Dúvidas</a>
            <Link to="/login">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
