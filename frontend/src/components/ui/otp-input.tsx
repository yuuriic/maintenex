import {
  useCallback, useEffect, useId, useRef, useState,
  type ChangeEvent, type ClipboardEvent, type FocusEvent, type KeyboardEvent,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export type OtpStatus = 'idle' | 'error' | 'success'

interface OtpInputProps {
  length: number
  value: string
  onChange: (value: string) => void
  status?: OtpStatus
  message?: string
  label?: string
  disabled?: boolean
  autoFocus?: boolean
}

export default function OtpInput({
  length, value, onChange, status = 'idle', message = '',
  label = 'Código de confirmação', disabled = false, autoFocus = false,
}: OtpInputProps) {
  const reduced = useReducedMotion()
  const statusId = useId()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const chars = Array.from({ length }, (_, indice) => value[indice] ?? '')

  const focusAt = useCallback((indice: number) => {
    const input = refs.current[Math.max(0, Math.min(length - 1, indice))]
    input?.focus()
    input?.select()
  }, [length])

  const commit = useCallback((next: string[]) => {
    onChange(next.join('').replace(/\D/g, '').slice(0, length))
  }, [length, onChange])

  const fillFrom = useCallback((indice: number, texto: string) => {
    const entrada = texto.replace(/\D/g, '')
    if (!entrada) return
    const next = [...chars]
    let cursor = entrada.length >= length ? 0 : indice
    for (const caractere of entrada) {
      if (cursor >= length) break
      next[cursor++] = caractere
    }
    commit(next)
    window.requestAnimationFrame(() => focusAt(Math.min(cursor, length - 1)))
  }, [chars, commit, focusAt, length])

  useEffect(() => {
    if (autoFocus && !disabled) focusAt(0)
  }, [autoFocus, disabled, focusAt])

  useEffect(() => {
    if (status === 'error' && !disabled) focusAt(0)
  }, [status, disabled, focusAt])

  function cellProps(index: number) {
    return {
      ref: (elemento: HTMLInputElement | null) => { refs.current[index] = elemento },
      value: chars[index],
      disabled,
      onChange: (evento: ChangeEvent<HTMLInputElement>) => {
        const entrada = evento.currentTarget.value.replace(/\D/g, '')
        if (!entrada) {
          const next = [...chars]; next[index] = ''; commit(next); return
        }
        if (entrada.length > 1) { fillFrom(index, entrada); return }
        const next = [...chars]; next[index] = entrada; commit(next)
        window.requestAnimationFrame(() => focusAt(index + 1))
      },
      onKeyDown: (evento: KeyboardEvent<HTMLInputElement>) => {
        if (evento.key === 'Backspace') {
          evento.preventDefault()
          const next = [...chars]
          if (next[index]) next[index] = ''
          else if (index > 0) { next[index - 1] = ''; focusAt(index - 1) }
          commit(next)
        } else if (evento.key === 'ArrowLeft') { evento.preventDefault(); focusAt(index - 1) }
        else if (evento.key === 'ArrowRight') { evento.preventDefault(); focusAt(index + 1) }
      },
      onPaste: (evento: ClipboardEvent<HTMLInputElement>) => {
        evento.preventDefault(); fillFrom(index, evento.clipboardData.getData('text'))
      },
      onFocus: (evento: FocusEvent<HTMLInputElement>) => {
        evento.currentTarget.select(); setFocusedIndex(index)
      },
      onBlur: (evento: FocusEvent<HTMLInputElement>) => {
        const destino = evento.relatedTarget as HTMLInputElement | null
        if (!destino || !refs.current.includes(destino)) setFocusedIndex(-1)
      },
    }
  }

  return (
    <div className="otp-campo">
      <span className="otp-label">{label}</span>
      <motion.div role="group" aria-label={label} className="otp-grupo"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        initial={false} animate={status === 'error' && !reduced ? { x: [0, -5, 4, -3, 0] } : { x: 0 }}
        transition={{ duration: reduced ? 0 : .32 }}>
        {chars.map((char, index) => (
          <div key={index} className={`otp-celula-wrap ${index === Math.ceil(length / 2) ? 'otp-separador' : ''}`}>
            <input {...cellProps(index)} type="text" inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={length}
              aria-label={`${label}, dígito ${index + 1} de ${length}`}
              aria-invalid={status === 'error' || undefined}
              aria-describedby={message ? statusId : undefined}
              className={`otp-celula ${focusedIndex === index ? 'focada' : ''} ${status}`} />
            <span aria-hidden className="otp-caractere">
              <AnimatePresence initial={false} mode="popLayout">
                {char && <motion.span key={char}
                  initial={reduced ? false : { opacity: 0, scale: .96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                  {char}
                </motion.span>}
              </AnimatePresence>
            </span>
          </div>
        ))}
      </motion.div>
      {message && <span id={statusId} role="status" className={`otp-mensagem ${status}`}>{message}</span>}
    </div>
  )
}
