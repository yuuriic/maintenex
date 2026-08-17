const API_URL = import.meta.env.VITE_API_URL ?? ''

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('maintenex_token')
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!response.ok) throw new Error(`Erro ${response.status} ao acessar a API`)
  return response.json() as Promise<T>
}
