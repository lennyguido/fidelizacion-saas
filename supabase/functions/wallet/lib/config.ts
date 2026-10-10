// Configuración leída de los secrets de la Edge Function (docs/WALLET.md).
// Nada de esto tiene valores por defecto: sin secrets, el proveedor queda "apagado".

export type Env = Record<string, string | undefined>

export interface GoogleConfig {
  issuerId: string
  clientEmail: string
  privateKeyPem: string
}

export interface AppleConfig {
  passTypeId: string
  teamId: string
  certPem: string
  keyPem: string
  keyPassphrase: string | null
  wwdrPem: string
}

export interface Config {
  supabaseUrl: string | null
  serviceKey: string | null
  google: GoogleConfig | null
  apple: AppleConfig | null
  syncSecret: string | null
  allowedOrigins: string[]
  defaultLogoUrl: string | null
}

function clean(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

/** Acepta el PEM tal cual, con "\n" escritos como texto, o en base64. */
export function readPem(value: string | undefined): string | null {
  const v = clean(value)
  if (!v) return null
  const text = v.includes('-----BEGIN') ? v : safeAtob(v)
  if (!text || !text.includes('-----BEGIN')) return null
  return text.replace(/\\n/g, '\n')
}

function safeAtob(value: string): string | null {
  try {
    return atob(value)
  } catch {
    return null
  }
}

/** El JSON de la cuenta de servicio de Google, tal cual o en base64. */
export function readServiceAccount(
  value: string | undefined,
): { clientEmail: string; privateKeyPem: string } | null {
  const v = clean(value)
  if (!v) return null
  const text = v.startsWith('{') ? v : safeAtob(v)
  if (!text) return null
  try {
    const json = JSON.parse(text) as { client_email?: unknown; private_key?: unknown }
    if (typeof json.client_email !== 'string' || typeof json.private_key !== 'string') return null
    const privateKeyPem = readPem(json.private_key)
    return privateKeyPem ? { clientEmail: json.client_email, privateKeyPem } : null
  } catch {
    return null
  }
}

/** SUPABASE_SERVICE_ROLE_KEY (clave clásica) o la primera de SUPABASE_SECRET_KEYS. */
export function readServiceKey(env: Env): string | null {
  const legacy = clean(env.SUPABASE_SERVICE_ROLE_KEY)
  if (legacy) return legacy
  const keys = clean(env.SUPABASE_SECRET_KEYS)
  if (!keys) return null
  try {
    const parsed = JSON.parse(keys) as Record<string, unknown>
    const first = Object.values(parsed).find((k) => typeof k === 'string')
    return typeof first === 'string' ? first : null
  } catch {
    return null
  }
}

export function readConfig(env: Env): Config {
  const issuerId = clean(env.GOOGLE_WALLET_ISSUER_ID)
  const account = readServiceAccount(env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON)
  const google = issuerId && /^\d+$/.test(issuerId) && account ? { issuerId, ...account } : null

  const certPem = readPem(env.APPLE_PASS_CERT_PEM)
  const keyPem = readPem(env.APPLE_PASS_KEY_PEM)
  const wwdrPem = readPem(env.APPLE_WWDR_PEM)
  const passTypeId = clean(env.APPLE_PASS_TYPE_ID)
  const teamId = clean(env.APPLE_TEAM_ID)
  const apple =
    certPem && keyPem && wwdrPem && passTypeId && teamId
      ? {
          passTypeId,
          teamId,
          certPem,
          keyPem,
          wwdrPem,
          keyPassphrase: clean(env.APPLE_PASS_KEY_PASSPHRASE),
        }
      : null

  return {
    supabaseUrl: clean(env.SUPABASE_URL)?.replace(/\/$/, '') ?? null,
    serviceKey: readServiceKey(env),
    google,
    apple,
    syncSecret: clean(env.WALLET_SYNC_SECRET),
    allowedOrigins: (clean(env.WALLET_ALLOWED_ORIGINS) ?? '')
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
    defaultLogoUrl: clean(env.WALLET_DEFAULT_LOGO_URL),
  }
}

/** Qué billeteras están listas (GET /wallet/status). Nunca revela valores. */
export function walletStatus(config: Config): { google: boolean; apple: boolean } {
  const db = !!config.supabaseUrl && !!config.serviceKey
  return { google: db && !!config.google, apple: db && !!config.apple }
}
