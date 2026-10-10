// Guardar la tarjeta en Google Wallet / Apple Wallet (docs/WALLET.md).
// Habla con la Edge Function `wallet`; la tarjeta solo manda su código secreto (D-020).
import { getSupabase } from './client.ts'

export type WalletProvider = 'google' | 'apple'

export interface WalletStatus {
  google: boolean
  apple: boolean
}

export type WalletErrorCode =
  | 'not_configured'
  | 'card_not_found'
  | 'logo_required'
  | 'provider_error'
  | 'network'
  | 'unknown'

export class WalletError extends Error {
  readonly code: WalletErrorCode

  constructor(code: WalletErrorCode, message = code) {
    super(message)
    this.name = 'WalletError'
    this.code = code
  }
}

const NONE: WalletStatus = { google: false, apple: false }

/** Si la función no contesta bien, no se muestra ningún botón. */
export function parseWalletStatus(raw: unknown): WalletStatus {
  if (!raw || typeof raw !== 'object') return NONE
  const value = raw as Record<string, unknown>
  return { google: value.google === true, apple: value.apple === true }
}

/** Traduce la respuesta de error de la función a un código estable. */
export function walletErrorCode(status: number | null, body: unknown): WalletErrorCode {
  const code =
    body && typeof body === 'object' ? (body as Record<string, unknown>).error : undefined
  switch (code) {
    case 'not_configured':
      return 'not_configured'
    case 'invalid_token':
    case 'card_not_found':
      return 'card_not_found'
    case 'logo_required':
      return 'logo_required'
    case 'provider_error':
      return 'provider_error'
  }
  if (status === null) return 'network'
  if (status === 501) return 'not_configured'
  if (status === 404) return 'card_not_found'
  if (status === 502) return 'provider_error'
  return 'unknown'
}

export function walletErrorMessage(error: unknown): string {
  const code = error instanceof WalletError ? error.code : 'unknown'
  const messages: Record<WalletErrorCode, string> = {
    not_configured: 'Esta opción todavía no está disponible para este negocio.',
    card_not_found:
      'Este link ya no funciona. Pedí el link actualizado en la caja y probá de nuevo.',
    logo_required:
      'El negocio todavía no cargó su logo, que hace falta para la billetera. Avisale en la caja.',
    provider_error: 'La billetera no respondió. Probá de nuevo en unos minutos.',
    network: 'No hay conexión. Revisá tu internet y probá de nuevo.',
    unknown: 'No se pudo agregar la tarjeta. Probá de nuevo en unos minutos.',
  }
  return messages[code]
}

/** Solo se redirige a la página oficial de Google o a la descarga del pase de Apple. */
export function isWalletRedirect(provider: WalletProvider, url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (provider === 'google') {
    return parsed.host === 'pay.google.com' && parsed.pathname.startsWith('/gp/v/save/')
  }
  return parsed.pathname.includes('/functions/v1/wallet/apple/download/')
}

interface ErrorWithContext {
  context?: unknown
}

async function errorFromInvoke(error: unknown): Promise<WalletError> {
  const context = (error as ErrorWithContext | null)?.context
  if (context instanceof Response) {
    const body: unknown = await context.json().catch(() => null)
    return new WalletError(walletErrorCode(context.status, body))
  }
  return new WalletError('network', error instanceof Error ? error.message : String(error))
}

export async function getWalletStatus(): Promise<WalletStatus> {
  const { data, error } = await getSupabase().functions.invoke('wallet/status', { method: 'GET' })
  if (error) return NONE
  return parseWalletStatus(data)
}

/** Devuelve el link al que hay que ir para guardar la tarjeta en la billetera. */
export async function walletSaveUrl(provider: WalletProvider, token: string): Promise<string> {
  const { data, error } = await getSupabase().functions.invoke(`wallet/${provider}`, {
    method: 'POST',
    body: { token },
  })
  if (error) throw await errorFromInvoke(error)
  const url = (data as { url?: unknown } | null)?.url
  if (typeof url !== 'string' || !isWalletRedirect(provider, url)) {
    throw new WalletError('unknown', 'unexpected wallet response')
  }
  return url
}
