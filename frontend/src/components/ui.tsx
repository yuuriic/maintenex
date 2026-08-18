import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react'

export function Badge({ tom, children }: { tom: string; children: ReactNode }) {
  return <span className={`badge ${tom}`}>{children}</span>
}

export function StatCard({ rotulo, valor, detalhe, icone, tom = 'azul' }: {
  rotulo: string; valor: ReactNode; detalhe?: string; icone?: ReactNode; tom?: string
}) {
  return (
    <article className={`card ${tom}`}>
      <div className="card-topo">
        <span>{rotulo}</span>
        {icone && <div className="card-icone">{icone}</div>}
      </div>
      <strong>{valor}</strong>
      {detalhe && <small>{detalhe}</small>}
    </article>
  )
}

export function Painel({ titulo, acao, children, className = '' }: {
  titulo: string; acao?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <article className={`panel ${className}`}>
      <header className="panel-head"><h2>{titulo}</h2>{acao}</header>
      {children}
    </article>
  )
}

export function Vazio({ texto = 'Sem dados para exibir', compacto = false }) {
  return (
    <div className={`empty ${compacto ? 'compact' : ''}`}>
      <Inbox size={compacto ? 20 : 26} />
      <span>{texto}</span>
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }) {
  return <div className="empty"><Loader2 size={22} className="girando" /><span>{texto}</span></div>
}

export function Skeleton({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="skeleton-lista">
      {Array.from({ length: linhas }).map((_, i) => <div key={i} className="skeleton" />)}
    </div>
  )
}

export function Modal({ aberto, titulo, onFechar, children, largura = 560 }: {
  aberto: boolean; titulo: string; onFechar: () => void; children: ReactNode; largura?: number
}) {
  useEffect(() => {
    if (!aberto) return
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', fechar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', fechar)
      document.body.style.overflow = ''
    }
  }, [aberto, onFechar])

  if (!aberto) return null
  return (
    <div className="modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal" style={{ maxWidth: largura }} role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h3>{titulo}</h3>
          <button className="icone-btn" onClick={onFechar} aria-label="Fechar"><X size={17} /></button>
        </header>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmarExclusao({ aberto, texto, onCancelar, onConfirmar }: {
  aberto: boolean; texto: string; onCancelar: () => void; onConfirmar: () => void
}) {
  return (
    <Modal aberto={aberto} titulo="Confirmar exclusão" onFechar={onCancelar} largura={420}>
      <div className="confirmar">
        <AlertTriangle size={22} />
        <p>{texto}</p>
      </div>
      <div className="modal-acoes">
        <button className="btn" onClick={onCancelar}>Cancelar</button>
        <button className="btn perigo" onClick={onConfirmar}>Excluir</button>
      </div>
    </Modal>
  )
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>
}
