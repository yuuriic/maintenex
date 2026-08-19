import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronsLeft, LogOut, Moon, PanelLeft, Search, Sun } from 'lucide-react'
import { navegacaoVisivel } from './navegacao'
import { AnimatedIcon } from './AnimatedIcon'
import { CommandPalette } from './CommandPalette'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'
import { aplicarSeo } from '../lib/seo'

export default function Layout() {
  const { tema, alternarTema, cidades, setores, cidadeId, setorId, setCidadeId, setSetorId, ehSuperAdmin } = useApp()
  const { profile, sair } = useAuth()
  const [recolhida, setRecolhida] = useState(false)
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

  const iniciais = (profile?.nome ?? 'US')
    .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'US'

  return (
    <div className={`shell ${recolhida ? 'recolhida' : ''}`}>
      <aside>
        <div className="brand">
          <div className="brand-mark">M</div>
          <div className="brand-texto">
            <b>Maintenex</b>
            <small>{profile?.empresas?.nome ?? 'Gestão de manutenção'}</small>
          </div>
          <button className="icone-btn recolher" onClick={() => setRecolhida((v) => !v)}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}>
            {recolhida ? <PanelLeft size={16} /> : <ChevronsLeft size={16} />}
          </button>
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

      <main>
        <header>
          <button className="busca-atalho" onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
          }}>
            <Search size={15} /><span>Buscar</span><kbd>⌘K</kbd>
          </button>

          <select aria-label="Cidade" value={cidadeId ?? ''} onChange={(e) => setCidadeId(e.target.value || null)}>
            {!cidades.length && <option value="">Sem cidades</option>}
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

          <div className="perfil">
            <div className="profile" title={profile?.email}>{iniciais}</div>
            <div className="perfil-texto">
              <b>{profile?.nome ?? 'Usuário'}</b>
              <small>{profile?.papel ?? '—'}</small>
            </div>
          </div>
        </header>

        <div className="content"><Outlet /></div>
      </main>

      <CommandPalette />
    </div>
  )
}
