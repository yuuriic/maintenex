import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

type Tipo = 'sucesso' | 'erro' | 'info'
interface Item { id: number; tipo: Tipo; texto: string }

interface ToastContextValue {
  sucesso: (texto: string) => void
  erro: (texto: string) => void
  info: (texto: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
let proximoId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Item[]>([])

  const remover = useCallback((id: number) => {
    setItens((atual) => atual.filter((i) => i.id !== id))
  }, [])

  const adicionar = useCallback((tipo: Tipo, texto: string) => {
    const id = proximoId++
    setItens((atual) => [...atual, { id, tipo, texto }])
    setTimeout(() => remover(id), 4500)
  }, [remover])

  const valor = useMemo<ToastContextValue>(() => ({
    sucesso: (t) => adicionar('sucesso', t),
    erro: (t) => adicionar('erro', t),
    info: (t) => adicionar('info', t),
  }), [adicionar])

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {itens.map((item) => (
          <div key={item.id} className={`toast ${item.tipo}`}>
            {item.tipo === 'sucesso' && <CheckCircle2 size={17} />}
            {item.tipo === 'erro' && <XCircle size={17} />}
            {item.tipo === 'info' && <Info size={17} />}
            <span>{item.texto}</span>
            <button onClick={() => remover(item.id)} aria-label="Fechar"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
