import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Moon, MoreHorizontal, Sun } from 'lucide-react'
import { navegacaoMobile } from './navegacao'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'

/**
 * Navegação mobile do shell autenticado. Os itens vêm de navegacaoMobile — a mesma
 * lista (e a mesma regra de visibilidade) da sidebar desktop; aqui muda só a
 * apresentação: os primeiros viram atalhos fixos e o restante abre no menu "Mais".
 */
export function BottomNav({ maisAberto, onAlternarMais, botaoMaisRef }: {
  maisAberto: boolean
  onAlternarMais: () => void
  botaoMaisRef: React.RefObject<HTMLButtonElement | null>
}) {
  const { ehSuperAdmin } = useApp()
  const { pathname } = useLocation()
  const { atalhos, demais } = navegacaoMobile(ehSuperAdmin)
  // A página atual pode estar dentro de "Mais": o botão assume o estado ativo para
  // o usuário saber onde está mesmo sem o módulo aparecer como atalho.
  const demaisAtivo = demais.some((item) => pathname === item.caminho)

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {atalhos.map(({ id, rotulo, rotuloCurto, caminho, icone: Icone }) => (
        <NavLink key={id} to={caminho} end={caminho === '/app'} aria-label={rotulo} title={rotulo}>
          <Icone size={22} strokeWidth={1.9} aria-hidden />
          <span>{rotuloCurto ?? rotulo}</span>
        </NavLink>
      ))}
      <button
        ref={botaoMaisRef}
        type="button"
        className={maisAberto || demaisAtivo ? 'active' : ''}
        aria-haspopup="dialog"
        aria-expanded={maisAberto}
        aria-controls="menu-mais"
        onClick={onAlternarMais}
      >
        <MoreHorizontal size={22} strokeWidth={1.9} aria-hidden />
        <span>Mais</span>
      </button>
    </nav>
  )
}

/** Bottom sheet com os módulos que não cabem na barra, mais tema e saída (o rodapé da sidebar). */
export function MenuMais({ aberto, onFechar, aoFecharFocar }: {
  aberto: boolean
  onFechar: () => void
  aoFecharFocar: React.RefObject<HTMLButtonElement | null>
}) {
  const { ehSuperAdmin, tema, alternarTema } = useApp()
  const { profile, sair } = useAuth()
  const { pathname } = useLocation()
  const primeiroRef = useRef<HTMLAnchorElement | null>(null)
  const estavaAberto = useRef(false)
  const { demais } = navegacaoMobile(ehSuperAdmin)

  // Navegar fecha o menu; a rota muda pelo NavLink e o efeito cuida do estado.
  useEffect(() => { if (aberto) onFechar() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (aberto) {
      estavaAberto.current = true
      primeiroRef.current?.focus()
      const teclado = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
      document.addEventListener('keydown', teclado)
      return () => document.removeEventListener('keydown', teclado)
    }
    if (estavaAberto.current) {
      estavaAberto.current = false
      aoFecharFocar.current?.focus()
    }
  }, [aberto, onFechar, aoFecharFocar])

  if (!aberto) return null

  const iniciais = (profile?.nome ?? 'US')
    .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'US'

  return (
    <div className="sheet-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div id="menu-mais" className="sheet" role="dialog" aria-modal="true" aria-label="Mais opções">
        <div className="sheet-alca" aria-hidden />
        <div className="sheet-perfil">
          <div className="profile">{iniciais}</div>
          <div className="perfil-texto">
            <b>{profile?.nome ?? 'Usuário'}</b>
            <small><span className="sheet-papel">{profile?.papel ?? '—'}</span>{profile?.empresas?.nome ? ` · ${profile.empresas.nome}` : ''}</small>
          </div>
        </div>

        {demais.length > 0 && (
          <nav className="sheet-nav" aria-label="Outros módulos">
            {demais.map(({ id, rotulo, caminho, icone: Icone }, i) => (
              <NavLink key={id} ref={i === 0 ? primeiroRef : undefined} to={caminho} end={caminho === '/app'} className="sheet-item">
                <Icone size={20} strokeWidth={1.9} aria-hidden />
                <span>{rotulo}</span>
              </NavLink>
            ))}
          </nav>
        )}

        <div className="sheet-acoes">
          <button type="button" className="sheet-item" onClick={alternarTema}>
            {tema === 'escuro' ? <Sun size={20} strokeWidth={1.9} aria-hidden /> : <Moon size={20} strokeWidth={1.9} aria-hidden />}
            <span>{tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}</span>
          </button>
          <button type="button" className="sheet-item perigo" onClick={() => void sair()}>
            <LogOut size={20} strokeWidth={1.9} aria-hidden />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  )
}
