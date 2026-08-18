export const nf = new Intl.NumberFormat('pt-BR')

export function data(valor?: string | null) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function dataHora(valor?: string | null) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function diasDesde(valor?: string | null) {
  if (!valor) return 0
  return Math.max(0, Math.round((Date.now() - new Date(valor).getTime()) / 86_400_000))
}

export function titulo(valor: string) {
  return valor.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function baixarCsv(nomeArquivo: string, linhas: Record<string, unknown>[]) {
  if (!linhas.length) return
  const colunas = Object.keys(linhas[0])
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    colunas.join(';'),
    ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(';')),
  ].join('\n')

  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}
