// Cliente mínimo de la API REST de Google Wallet (con reintentos en 429/5xx).
import type { GoogleConfig } from '../lib/config.ts'
import { importRsaPrivateKey, signJwt } from './jwt.ts'
import {
  buildLoyaltyClass,
  buildLoyaltyObject,
  buildMessage,
  buildObjectPatch,
  oauthClaims,
} from './objects.ts'
import type { PassData } from '../lib/passData.ts'

const API = 'https://walletobjects.googleapis.com/walletobjects/v1'

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'GoogleApiError'
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504])

export interface GoogleApiOptions {
  fetch: typeof fetch
  /** Espera entre reintentos (se reemplaza en los tests). */
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** `${SUPABASE_URL}/functions/v1/wallet/stamps.png`: imagen de sellos del pase. */
  stampImageBase?: string | null
}

export function createGoogleApi(config: GoogleConfig, options: GoogleApiOptions) {
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const now = options.now ?? (() => Date.now())
  let keyPromise: Promise<CryptoKey> | null = null
  let token: { value: string; expiresAt: number } | null = null

  const stampBase = options.stampImageBase ?? null
  const key = () => (keyPromise ??= importRsaPrivateKey(config.privateKeyPem))

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt - 60_000 > now()) return token.value
    const assertion = await signJwt(
      oauthClaims(config.clientEmail, Math.floor(now() / 1000)),
      await key(),
    )
    const res = await options.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string
      expires_in?: number
    }
    if (!res.ok || !body.access_token)
      throw new GoogleApiError(res.status, 'oauth token request failed')
    token = { value: body.access_token, expiresAt: now() + (body.expires_in ?? 3600) * 1000 }
    return token.value
  }

  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await options.fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!RETRYABLE.has(res.status) || attempt >= 2) return res
      await res.body?.cancel()
      await sleep(300 * 2 ** attempt)
    }
  }

  async function expectOk(res: Response, what: string): Promise<void> {
    if (res.ok) {
      await res.body?.cancel()
      return
    }
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    throw new GoogleApiError(res.status, `${what} failed (${res.status}): ${detail}`)
  }

  /** Crea la clase del negocio o, si ya existe, la actualiza (nombre, logo, color). */
  async function upsertClass(data: PassData, logoUrl: string): Promise<void> {
    const loyaltyClass = buildLoyaltyClass(config.issuerId, data, logoUrl)
    const res = await call('POST', '/loyaltyClass', loyaltyClass)
    if (res.status !== 409) return expectOk(res, 'insert class')
    await res.body?.cancel()
    const { id: _id, ...fields } = loyaltyClass
    await expectOk(
      await call('PATCH', `/loyaltyClass/${encodeURIComponent(loyaltyClass.id)}`, fields),
      'patch class',
    )
  }

  /** Crea el objeto del socio o, si ya existe, actualiza su saldo. */
  async function upsertObject(data: PassData): Promise<void> {
    const object = buildLoyaltyObject(config.issuerId, data, stampBase)
    const res = await call('POST', '/loyaltyObject', object)
    if (res.status !== 409) return expectOk(res, 'insert object')
    await res.body?.cancel()
    await expectOk(
      await call(
        'PATCH',
        `/loyaltyObject/${encodeURIComponent(object.id)}`,
        buildObjectPatch(data, false, stampBase),
      ),
      'patch object',
    )
  }

  /** Sync: actualiza el saldo. Devuelve 'gone' si Google ya no tiene el objeto. */
  async function patchObject(data: PassData, notify: boolean): Promise<'ok' | 'gone'> {
    const id = buildLoyaltyObject(config.issuerId, data).id
    const res = await call(
      'PATCH',
      `/loyaltyObject/${encodeURIComponent(id)}`,
      buildObjectPatch(data, notify, stampBase),
    )
    if (res.status === 404) {
      await res.body?.cancel()
      return 'gone'
    }
    await expectOk(res, 'patch object')
    return 'ok'
  }

  /** Agrega un mensaje al pase (Google avisa en el teléfono; máx. 3 por día). */
  async function addMessage(data: PassData, header: string, body: string, messageId: string) {
    const id = buildLoyaltyObject(config.issuerId, data).id
    const res = await call(
      'POST',
      `/loyaltyObject/${encodeURIComponent(id)}/addMessage`,
      buildMessage(messageId, header, body),
    )
    await expectOk(res, 'add message')
  }

  return { accessToken, upsertClass, upsertObject, patchObject, addMessage }
}

export type GoogleApi = ReturnType<typeof createGoogleApi>
