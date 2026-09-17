import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, ChevronsRight, LogOut, MapPin, Moon, Search, Sun } from 'lucide-react'
import { navegacaoVisivel } from './navegacao'
import { AnimatedIcon } from './AnimatedIcon'
import { CommandPalette } from './CommandPalette'
import { BottomNav, MenuMais } from './BottomNav'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'
import { useMediaQuery, QUERY_MOBILE } from '../hooks/useMediaQuery'
import { aplicarSeo } from '../lib/seo'
import BrandMark from './ui/brand-mark'

function abrirBusca() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
}

/** Escopo global (cidade/setor): o mesmo par de selects na topbar desktop e no painel mobile. */
function SeletoresEscopo() {
  const { cidades, setores, cidadeId, setorId, setCidadeId, setSetorId, ehSuperAdmin } = useApp()
  return (
    <>
      <select aria-label="Cidade" value={cidadeId ?? ''} onChange={(e) => setCidadeId(e.target.value || null)}>
        <option value="">Todas as cidades</option>
        {cidades.map((c) => (
          <option key={c.id} value={c.id}>
            {ehSuperAdmin && c.empresas?.nome ? `${c.empresas.nome} · ` : ''}{c.nome} - {c.uf}
          </option>
        ))}
      </select>

      <select aria-label="Setor" value={setorId ?? ''} onChange={(e) => setSetorId(e.target.value || null)}>
        <option value="">Todos os setores</option>
        {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
    </>
  )
}

export default function Layout() {
  const { tema, alternarTema, ehSuperAdmin, cidadeAtual, setorId, setores } = useApp()
  const { profile, sair } = useAuth()
  const [recolhida, setRecolhida] = useState(false)
  const [maisAberto, setMaisAberto] = useState(false)
  const [escopoAberto, setEscopoAberto] = useState(false)
  const botaoMaisRef = useRef<HTMLButtonElement | null>(null)
  const ehMobile = useMediaQuery(QUERY_MOBILE)
  const { pathname } = useLocation()

  useEffect(() => {
    const atual = navegacaoVisivel(true).find((i) => i.caminho === pathname)
    aplicarSeo({
      titulo: `${atual?.rotulo ?? 'Painel'} · Maintenex`,
      descricao: 'Painel interno do Maintenex.',
      caminho: pathname,
      noindex: true,
    })
  }, [pathname])

  // Trocar de página no mobile recolhe o painel de escopo para devolver a área ao conteúdo.
  useEffect(() => { setEscopoAberto(false) }, [pathname])

  const fecharMais = useCallback(() => setMaisAberto(false), [])

  const iniciais = (profile?.nome ?? 'US')
    .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'US'

  const setorAtual = setorId ? setores.find((s) => s.id === setorId)?.nome : null
  const resumoEscopo = `${cidadeAtual ? `${cidadeAtual.nome} - ${cidadeAtual.uf}` : 'Todas as cidades'} · ${setorAtual ?? 'Todos os setores'}`

  return (
    <div className={`shell ${recolhida ? 'recolhida' : ''} ${ehMobile ? 'shell-mobile' : ''}`}>
      {!ehMobile && (
        <aside>
          <button
            type="button"
            className="recolher"
            onClick={() => setRecolhida((v) => !v)}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!recolhida}
            title={recolhida ? 'Expandir menu' : 'Recolher menu'}
          >
            {recolhida ? (
              <ChevronsRight size={19} strokeWidth={2.7} />
            ) : (
              <ChevronsLeft size={18} strokeWidth={2.4} />
            )}
          </button>
          <div className="brand">
            <BrandMark />
            <div className="brand-texto">
              <b>Maintenex</b>
              <small>{profile?.empresas?.nome ?? 'Gestão de manutenção'}</small>
            </div>
          </div>

          <nav>
            {navegacaoVisivel(ehSuperAdmin).map(({ rotulo, caminho, icone }) => (
              <NavLink key={caminho} to={caminho} end={caminho === '/app'} title={rotulo}>
                <AnimatedIcon icon={icone} />
                <span className="nav-rotulo">{rotulo}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-rodape">
            <button className="nav-acao" onClick={alternarTema}>
              <AnimatedIcon icon={tema === 'escuro' ? Sun : Moon} size={18} />
              <span className="nav-rotulo">{tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}</span>
            </button>
            <button className="nav-acao" onClick={() => void sair()}>
              <AnimatedIcon icon={LogOut} size={18} />
              <span className="nav-rotulo">Sair</span>
            </button>
          </div>
        </aside>
      )}

      <main>
        {ehMobile ? (
          <header className="topbar-mobile">
            <div className="topbar-mobile-linha">
              <BrandMark />
              <button
                type="button"
                className="escopo-atual"
                onClick={() => setEscopoAberto((v) => !v)}
                aria-expanded={escopoAberto}
                aria-controls="escopo-mobile"
                aria-label={`Escopo: ${resumoEscopo}. ${escopoAberto ? 'Ocultar' : 'Alterar'} filtros de cidade e setor`}
              >
                <MapPin size={15} aria-hidden />
                <span>{resumoEscopo}</span>
                <ChevronDown size={15} aria-hidden className={escopoAberto ? 'girado' : ''} />
              </button>
              <button type="button" className="icone-btn topbar-acao" onClick={abrirBusca} aria-label="Buscar página">
                <Search size={19} />
              </button>
              <div className="profile" title={`${profile?.nome ?? 'Usuário'} · ${profile?.papel ?? '—'}`} aria-label={`${profile?.nome ?? 'Usuário'}, ${profile?.papel ?? '—'}`} role="img">{iniciais}</div>
            </div>
            <div id="escopo-mobile" className="escopo-mobile" hidden={!escopoAberto}>
              <SeletoresEscopo />
            </div>
          </header>
        ) : (
          <header>
            <button className="busca-atalho" onClick={abrirBusca}>
              <Search size={15} /><span>Buscar</span><kbd>⌘K</kbd>
            </button>

            <SeletoresEscopo />

            <div className="perfil">
              <div className="profile">{iniciais}</div>
              <div className="perfil-texto">
                <b>{profile?.nome ?? 'Usuário'}</b>
                <small>{profile?.papel ?? '—'}</small>
              </div>
            </div>
          </header>
        )}

        <div className="content"><Outlet /></div>
      </main>

      {ehMobile && (
        <>
          <BottomNav maisAberto={maisAberto} onAlternarMais={() => setMaisAberto((v) => !v)} botaoMaisRef={botaoMaisRef} />
          <MenuMais aberto={maisAberto} onFechar={fecharMais} aoFecharFocar={botaoMaisRef} />
        </>
      )}

      <CommandPalette />
    </div>
  )
}
