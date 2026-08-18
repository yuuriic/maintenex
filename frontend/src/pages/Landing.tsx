import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, Building2, CheckCircle2, ClipboardCheck,
  Printer, ShieldCheck, TriangleAlert, Users,
} from 'lucide-react'
import { aplicarJsonLd, aplicarSeo, SITE_URL } from '../lib/seo'

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

export default function Landing() {
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
        <section className="lp-hero">
          <div className="lp-glow" aria-hidden />
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-texto">
              <span className="lp-selo"><ShieldCheck size={14} />Gestão de manutenção em português</span>
              <h1>Manutenção sob controle, do checklist ao estoque.</h1>
              <p className="lp-lead">
                O Maintenex reúne checklists preventivos, controle de peças e pendências com SLA
                em um painel único. Sua equipe registra no campo, o almoxarifado dá baixa e a
                gestão acompanha por indicadores — sem planilha paralela.
              </p>
              <div className="lp-cta">
                <Link className="btn primario grande" to="/login?modo=cadastrar">
                  Criar conta da empresa<ArrowRight size={17} />
                </Link>
                <Link className="btn grande" to="/login">Já tenho acesso</Link>
              </div>
              <ul className="lp-bullets">
                <li><CheckCircle2 size={16} />Cadastro da empresa em minutos</li>
                <li><CheckCircle2 size={16} />Dados isolados por empresa</li>
                <li><CheckCircle2 size={16} />Exportação em CSV</li>
              </ul>
            </div>

            <div className="lp-mock" aria-hidden>
              <div className="lp-mock-topo"><span /><span /><span /></div>
              <div className="lp-mock-corpo">
                <div className="lp-mock-cards">
                  <div><small>Preventivas</small><b>128</b></div>
                  <div><small>Razão P/C</small><b>3,2</b></div>
                  <div><small>Pendências</small><b>7</b></div>
                  <div><small>SLA médio</small><b>1,8 d</b></div>
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
          </div>
        </section>

        <section id="recursos" className="lp-secao">
          <div className="lp-container">
            <header className="lp-secao-head">
              <h2>Tudo que a manutenção precisa, em um lugar</h2>
              <p>Seis módulos que conversam entre si — o checklist consome material, o material baixa do estoque, a falha vira pendência.</p>
            </header>
            <div className="lp-grid-3">
              {recursos.map((r) => (
                <article key={r.titulo} className="lp-card">
                  <span className="lp-card-icone"><r.icone size={20} /></span>
                  <h3>{r.titulo}</h3>
                  <p>{r.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="lp-secao alt">
          <div className="lp-container">
            <header className="lp-secao-head">
              <h2>Como funciona</h2>
              <p>Três passos entre criar a conta e ter o primeiro indicador na tela.</p>
            </header>
            <ol className="lp-passos">
              {passos.map((p, i) => (
                <li key={p.titulo}>
                  <span className="lp-passo-num">{i + 1}</span>
                  <div><h3>{p.titulo}</h3><p>{p.texto}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="niveis" className="lp-secao">
          <div className="lp-container">
            <header className="lp-secao-head">
              <h2>Três níveis de acesso</h2>
              <p>Da administração da plataforma até o técnico em campo, cada um enxerga o que precisa.</p>
            </header>
            <div className="lp-grid-3">
              <article className="lp-card destaque">
                <span className="lp-card-icone"><Building2 size={20} /></span>
                <h3>Administração da plataforma</h3>
                <p>Cria e acompanha as empresas clientes, com visão consolidada de todos os espaços.</p>
              </article>
              <article className="lp-card destaque">
                <span className="lp-card-icone"><ShieldCheck size={20} /></span>
                <h3>Responsável pela empresa</h3>
                <p>E-mail principal do cliente. Convida funcionários, define papéis e configura cidades e setores.</p>
              </article>
              <article className="lp-card destaque">
                <span className="lp-card-icone"><Users size={20} /></span>
                <h3>Equipe</h3>
                <p>Gestor, técnico ou leitor — cada papel com o nível de escrita adequado à função.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="perguntas" className="lp-secao alt">
          <div className="lp-container lp-faq">
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
        </section>

        <section className="lp-secao lp-final">
          <div className="lp-container">
            <h2>Comece pelo que já está parado</h2>
            <p>Cadastre a empresa, suba os equipamentos críticos e acompanhe o primeiro ciclo de preventivas.</p>
            <Link className="btn primario grande" to="/login?modo=cadastrar">Criar conta da empresa<ArrowRight size={17} /></Link>
          </div>
        </section>
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
