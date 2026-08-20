/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Domínio público, usado em canonical e Open Graph. */
  readonly VITE_SITE_URL?: string
  /** URL pública da API Spring. Sem ela, Auth usa Supabase diretamente. */
  readonly VITE_API_URL?: string
  /** Quantidade de dígitos configurada em Authentication → Email OTP length. */
  readonly VITE_EMAIL_OTP_LENGTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
