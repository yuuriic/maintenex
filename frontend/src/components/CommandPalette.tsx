import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { navegacaoVisivel } from './navegacao'
import { useApp } from '../lib/app-state'

export function CommandPalette() {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [indice, setIndice] = useState(0)
  const navegar = useNavigate()
  const { ehSuperAdmin } = useApp()

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAberto((v) => !v)
        setBusca('')
        setIndice(0)
      }
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('keydown', atalho)
    return () => document.removeEventListener('keydown', atalho)
  }, [])

  const resultados = useMemo(() => {
    const itens = navegacaoVisivel(ehSuperAdmin)
    const termo = busca.trim().toLowerCase()
    if (!termo) return itens
    return itens.filter((i) => i.rotulo.toLowerCase().includes(termo))
  }, [busca, ehSuperAdmin])

  if (!aberto) return null

  function ir(caminho: string) {
    navegar(caminho)
    setAberto(false)
  }

  return (
    <div className="modal-fundo topo" onMouseDown={(e) => { if (e.target === e.currentTarget) setAberto(false) }}>
      <div className="paleta" role="dialog" aria-modal="true" aria-label="Busca rápida">
        <div className="paleta-busca">
          <Search size={17} />
          <input
            autoFocus
            value={busca}
            placeholder="Buscar página…"
            onChange={(e) => { setBusca(e.target.value); setIndice(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((i) => (i + 1) % resultados.length) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => (i - 1 + resultados.length) % resultados.length) }
              if (e.key === 'Enter' && resultados[indice]) ir(resultados[indice].caminho)
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul className="paleta-lista">
          {resultados.map((item, i) => (
            <li key={item.caminho}>
              <button className={i === indice ? 'ativo' : ''} onMouseEnter={() => setIndice(i)}
                onClick={() => ir(item.caminho)}>
                <item.icone size={17} />
                <span>{item.rotulo}</span>
                {i === indice && <CornerDownLeft size={14} />}
              </button>
            </li>
          ))}
          {!resultados.length && <li className="paleta-vazio">Nada encontrado</li>}
        </ul>
      </div>
    </div>
  )
}
