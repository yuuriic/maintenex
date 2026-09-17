import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, LogOut, Moon, MoreHorizontal, Plus, RotateCcw, SlidersHorizontal, Sun } from 'lucide-react'
import {
  LIMITE_ATALHOS_MOBILE, atalhosPadrao, filtrarAtalhosPermitidos, navegacaoMobile, navegacaoVisivel,
} from './navegacao'
import { useApp } from '../lib/app-state'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from './Toast'

/**
 * Navegação mobile do shell autenticado. Os itens vêm de navegacaoMobile — a mesma
 * lista (e a mesma regra de visibilidade) da sidebar desktop; aqui muda só a
 * apresentação: os atalhos do usuário (ou os padrão) ficam fixos e o restante
 * abre no menu "Mais".
 */
export function BottomNav({ maisAberto, onAlternarMais, botaoMaisRef }: {
  maisAberto: boolean
  onAlternarMais: () => void
  botaoMaisRef: React.RefObject<HTMLButtonElement | null>
}) {
  const { ehSuperAdmin } = useApp()
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const { atalhos, demais } = navegacaoMobile(ehSuperAdmin, profile?.atalhos_mobile)
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

/** Fecha com Escape, foca o primeiro elemento ao abrir e devolve o foco ao gatilho ao fechar. */
function useSheet(aberto: boolean, onFechar: () => void, primeiroRef: React.RefObject<HTMLElement | null>, aoFecharFocar: React.RefObject<HTMLElement | null>) {
  const estavaAberto = useRef(false)
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
  }, [aberto, onFechar, primeiroRef, aoFecharFocar])
}

/** Bottom sheet com os módulos que não cabem na barra, mais tema e saída (o rodapé da sidebar). */
export function MenuMais({ aberto, onFechar, onPersonalizar, aoFecharFocar }: {
  aberto: boolean
  onFechar: () => void
  onPersonalizar: () => void
  aoFecharFocar: React.RefObject<HTMLButtonElement | null>
}) {
  const { ehSuperAdmin, tema, alternarTema } = useApp()
  const { profile, sair } = useAuth()
  const { pathname } = useLocation()
  const primeiroRef = useRef<HTMLAnchorElement | null>(null)
  const { demais } = navegacaoMobile(ehSuperAdmin, profile?.atalhos_mobile)

  // Navegar fecha o menu; a rota muda pelo NavLink e o efeito cuida do estado.
  useEffect(() => { if (aberto) onFechar() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  useSheet(aberto, onFechar, primeiroRef, aoFecharFocar)

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
          <button type="button" className="sheet-item" onClick={onPersonalizar}>
            <SlidersHorizontal size={20} strokeWidth={1.9} aria-hidden />
            <span>Personalizar atalhos</span>
          </button>
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

/**
 * Sheet "Personalizar atalhos": escolhe até LIMITE_ATALHOS_MOBILE módulos (entre os
 * que o usuário pode ver) e a ordem deles na barra. Persiste só os ids em
 * profiles.atalhos_mobile via atualizarPerfil — o mesmo caminho do "Meu perfil".
 */
export function PersonalizarAtalhos({ aberto, onFechar, aoFecharFocar }: {
  aberto: boolean
  onFechar: () => void
  aoFecharFocar: React.RefObject<HTMLButtonElement | null>
}) {
  const { ehSuperAdmin } = useApp()
  const { profile, atualizarPerfil } = useAuth()
  const toast = useToast()
  const primeiroRef = useRef<HTMLButtonElement | null>(null)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  const disponiveis = navegacaoVisivel(ehSuperAdmin)
  const salvos = useMemo(
    () => (profile?.atalhos_mobile ? filtrarAtalhosPermitidos(profile.atalhos_mobile, ehSuperAdmin) : atalhosPadrao(ehSuperAdmin)).map((item) => item.id),
    [profile?.atalhos_mobile, ehSuperAdmin],
  )

  // Cada abertura parte do que está salvo (ou do padrão); fechar descarta edições.
  useEffect(() => { if (aberto) setSelecionados(salvos) }, [aberto, salvos])
  useSheet(aberto, onFechar, primeiroRef, aoFecharFocar)

  if (!aberto) return null

  const limiteAtingido = selecionados.length >= LIMITE_ATALHOS_MOBILE
  const alterado = selecionados.join('|') !== salvos.join('|')
  const itensSelecionados = selecionados
    .map((id) => disponiveis.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => !!item)

  function alternar(id: string) {
    setSelecionados((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id)
      return atual.length >= LIMITE_ATALHOS_MOBILE ? atual : [...atual, id]
    })
  }

  function mover(id: string, direcao: -1 | 1) {
    setSelecionados((atual) => {
      const de = atual.indexOf(id)
      const para = de + direcao
      if (de < 0 || para < 0 || para >= atual.length) return atual
      const copia = [...atual]
      copia.splice(de, 1)
      copia.splice(para, 0, id)
      return copia
    })
  }

  async function persistir(ids: string[] | null) {
    setSalvando(true)
    try {
      // Revalida contra a permissão atual antes de gravar: só ids visíveis, sem duplicatas, no limite.
      const validos = ids ? filtrarAtalhosPermitidos(ids, ehSuperAdmin).map((item) => item.id) : null
      await atualizarPerfil({ atalhos_mobile: validos && validos.length ? validos : null })
      toast.sucesso(validos && validos.length ? 'Atalhos atualizados.' : 'Atalhos restaurados para o padrão.')
      onFechar()
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não foi possível salvar os atalhos.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="sheet-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="sheet sheet-atalhos" role="dialog" aria-modal="true" aria-labelledby="atalhos-titulo" aria-describedby="atalhos-contador">
        <div className="sheet-alca" aria-hidden />
        <header className="atalhos-cabecalho">
          <div>
            <h3 id="atalhos-titulo">Personalizar atalhos</h3>
            <p>Escolha até {LIMITE_ATALHOS_MOBILE} atalhos para a barra inferior. "Mais" é fixo.</p>
          </div>
          <span id="atalhos-contador" className={`atalhos-contador ${limiteAtingido ? 'limite' : ''}`} aria-live="polite">
            {selecionados.length} de {LIMITE_ATALHOS_MOBILE} selecionados{limiteAtingido ? ' · limite atingido' : ''}
          </span>
        </header>

        <div className="atalhos-previa" aria-label="Prévia da barra">
          {itensSelecionados.map(({ id, rotulo, rotuloCurto, icone: Icone }) => (
            <span key={id}><Icone size={18} strokeWidth={1.9} aria-hidden /><small>{rotuloCurto ?? rotulo}</small></span>
          ))}
          <span className="fixo"><MoreHorizontal size={18} strokeWidth={1.9} aria-hidden /><small>Mais</small></span>
        </div>

        <ul className="atalhos-lista" aria-label="Módulos disponíveis">
          {disponiveis.map(({ id, rotulo, icone: Icone }, i) => {
            const posicao = selecionados.indexOf(id)
            const selecionado = posicao >= 0
            const bloqueado = !selecionado && limiteAtingido
            return (
              <li key={id} className={selecionado ? 'selecionado' : bloqueado ? 'bloqueado' : ''}>
                <button
                  ref={i === 0 ? primeiroRef : undefined}
                  type="button"
                  className="atalhos-item"
                  aria-pressed={selecionado}
                  aria-disabled={bloqueado}
                  onClick={() => { if (!bloqueado) alternar(id) }}
                >
                  <span className="atalhos-marca" aria-hidden>{selecionado ? posicao + 1 : <Plus size={14} />}</span>
                  <Icone size={20} strokeWidth={1.9} aria-hidden />
                  <span className="atalhos-nome">{rotulo}</span>
                  {selecionado && <Check size={16} aria-hidden className="atalhos-check" />}
                </button>
                {selecionado && (
                  <span className="atalhos-ordem">
                    <button type="button" className="icone-btn" onClick={() => mover(id, -1)} disabled={posicao === 0} aria-label={`Mover ${rotulo} para a esquerda`}><ArrowUp size={16} /></button>
                    <button type="button" className="icone-btn" onClick={() => mover(id, 1)} disabled={posicao === selecionados.length - 1} aria-label={`Mover ${rotulo} para a direita`}><ArrowDown size={16} /></button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <div className="atalhos-acoes">
          <button type="button" className="btn" onClick={() => void persistir(null)} disabled={salvando || !profile?.atalhos_mobile}>
            <RotateCcw size={15} />Restaurar padrão
          </button>
          <div>
            <button type="button" className="btn" onClick={onFechar} disabled={salvando}>Cancelar</button>
            <button type="button" className="btn primario" onClick={() => void persistir(selecionados)} disabled={salvando || !alterado || !selecionados.length}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
