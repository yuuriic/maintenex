export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'https://maintenex.app').replace(/\/$/, '')

interface Seo {
  titulo: string
  descricao: string
  caminho?: string
  imagem?: string
  noindex?: boolean
}

function meta(seletor: string, atributo: 'name' | 'property', chave: string, conteudo: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(seletor)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(atributo, chave)
    document.head.appendChild(tag)
  }
  tag.content = conteudo
}

/** Atualiza title, description, canonical e cards sociais da rota atual. */
export function aplicarSeo({ titulo, descricao, caminho = '/', imagem = `${SITE_URL}/og-maintenex.png`, noindex }: Seo) {
  document.title = titulo
  const url = `${SITE_URL}${caminho}`

  meta('meta[name="description"]', 'name', 'description', descricao)
  meta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')

  meta('meta[property="og:title"]', 'property', 'og:title', titulo)
  meta('meta[property="og:description"]', 'property', 'og:description', descricao)
  meta('meta[property="og:url"]', 'property', 'og:url', url)
  meta('meta[property="og:image"]', 'property', 'og:image', imagem)
  meta('meta[property="og:type"]', 'property', 'og:type', 'website')

  meta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
  meta('meta[name="twitter:title"]', 'name', 'twitter:title', titulo)
  meta('meta[name="twitter:description"]', 'name', 'twitter:description', descricao)
  meta('meta[name="twitter:image"]', 'name', 'twitter:image', imagem)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = url
}

/** Injeta (ou substitui) um bloco JSON-LD identificado por `id`. */
export function aplicarJsonLd(id: string, dados: unknown) {
  let script = document.getElementById(id) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(dados)
}
