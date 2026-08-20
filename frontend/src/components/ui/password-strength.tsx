import { useMemo } from 'react'
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react'

export const REQUISITOS_SENHA = [
  { regex: /.{8,}/, texto: 'Pelo menos 8 caracteres' },
  { regex: /[0-9]/, texto: 'Pelo menos 1 número' },
  { regex: /[a-z]/, texto: 'Pelo menos 1 letra minúscula' },
  { regex: /[A-Z]/, texto: 'Pelo menos 1 letra maiúscula' },
  { regex: /[^A-Za-z0-9]/, texto: 'Pelo menos 1 caractere especial' },
] as const

export function senhaAtendeRequisitos(senha: string) {
  return REQUISITOS_SENHA.every(({ regex }) => regex.test(senha))
}

interface PasswordStrengthProps {
  id: string
  label: string
  password: string
  onChange: (value: string) => void
  visible: boolean
  onToggleVisible: () => void
  erro?: string
  autoFocus?: boolean
}

export default function PasswordStrength({
  id, label, password, onChange, visible, onToggleVisible, erro, autoFocus,
}: PasswordStrengthProps) {
  const requisitos = useMemo(() => REQUISITOS_SENHA.map((requisito) => ({
    ...requisito,
    atendido: requisito.regex.test(password),
  })), [password])
  const pontuacao = requisitos.filter(({ atendido }) => atendido).length
  const descricao = ['Digite uma senha', 'Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'][pontuacao]

  return (
    <div className="campo senha-forte">
      <label htmlFor={id}>{label}</label>
      <div className="campo-input">
        <Lock size={17} />
        <input id={id} type={visible ? 'text' : 'password'} value={password}
          onChange={(e) => onChange(e.target.value)} required minLength={8}
          autoComplete="new-password" autoFocus={autoFocus}
          aria-invalid={Boolean(password) && pontuacao < REQUISITOS_SENHA.length}
          aria-describedby={`${id}-forca ${id}-requisitos`} />
        <button type="button" className="icone-btn" onClick={onToggleVisible}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {erro && <small className="campo-erro">{erro}</small>}

      <div className="senha-forca-barras" aria-hidden>
        {REQUISITOS_SENHA.map((_, indice) => (
          <span key={indice} className={pontuacao > indice ? `nivel-${pontuacao}` : ''} />
        ))}
      </div>
      <div id={`${id}-forca`} className="senha-forca-texto">
        <span>A senha deve conter:</span><strong>{descricao}</strong>
      </div>
      <ul id={`${id}-requisitos`} className="senha-requisitos" aria-label="Requisitos da senha">
        {requisitos.map(({ texto, atendido }) => (
          <li key={texto} className={atendido ? 'atendido' : ''}>
            {atendido ? <Check size={15} /> : <X size={15} />}
            <span>{texto}<span className="sr-only"> — {atendido ? 'atendido' : 'não atendido'}</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}
