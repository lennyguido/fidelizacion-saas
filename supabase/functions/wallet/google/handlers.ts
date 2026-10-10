// POST /wallet/google        → link "Guardar en Google Wallet" para la tarjeta del link secreto.
// POST /wallet/google/sync   → manda a Google los saldos que cambiaron (cola loyalty.wallet_updates).
import type { Config, GoogleConfig } from '../lib/config.ts'
import type { Rpc } from '../lib/db.ts'
import { CARD_TOKEN, fail, json, readJson } from '../lib/http.ts'
import { toPassData, type PassData } from '../lib/passData.ts'
import { isPngOrJpeg, publicLogoUrl } from '../lib/text.ts'
import type { GoogleApi } from './api.ts'
import { importRsaPrivateKey, signJwt } from './jwt.ts'
import { GOOGLE_SAVE_URL, saveJwtClaims } from './objects.ts'

export interface GoogleDeps {
  config: Config & { google: GoogleConfig; supabaseUrl: string }
  rpc: Rpc
  api: GoogleApi
  now: () => number
  log: (message: string) => void
}

/** Logo para la clase: el del negocio si es PNG/JPG; si no, el de respaldo (secret). */
export function classLogoUrl(config: Config, data: PassData): string | null {
  if (config.supabaseUrl && isPngOrJpeg(data.business.logoPath)) {
    return publicLogoUrl(config.supabaseUrl, data.business.logoPath)
  }
  return config.defaultLogoUrl
}

export async function handleGoogleSave(req: Request, deps: GoogleDeps): Promise<Response> {
  const body = await readJson(req)
  const token = typeof body?.token === 'string' ? body.token.trim().toLowerCase() : ''
  if (!CARD_TOKEN.test(token)) return fail('invalid_token', 400)

  const data = toPassData(
    await deps.rpc('wallet_issue_pass', { p_card_token: token, p_provider: 'google' }),
  )
  if (!data) return fail('card_not_found', 404)

  const logoUrl = classLogoUrl(deps.config, data)
  if (!logoUrl) return fail('logo_required', 422)

  try {
    await deps.api.upsertClass(data, logoUrl)
    await deps.api.upsertObject(data)
  } catch (error) {
    deps.log(`google save failed: ${error instanceof Error ? error.message : String(error)}`)
    return fail('provider_error', 502)
  }

  const { google } = deps.config
  const claims = saveJwtClaims(
    google.clientEmail,
    google.issuerId,
    data,
    deps.config.allowedOrigins,
    Math.floor(deps.now() / 1000),
  )
  const jwt = await signJwt(claims, await importRsaPrivateKey(google.privateKeyPem))
  return json({ url: `${GOOGLE_SAVE_URL}${jwt}` })
}

interface ClaimedUpdate {
  updateId: number
  revision: number
  attempts: number
  pass: unknown
}

export interface SyncResult {
  processed: number
  done: number
  retry: number
  failed: number
  gone: number
}

/**
 * Procesa la cola en tandas hasta vaciarla o quedarse sin tiempo. Es idempotente:
 * mandar dos veces el mismo saldo deja a Google igual. Las fallas se reintentan
 * más tarde con espera creciente (loyalty.wallet_finish_update).
 */
export async function handleGoogleSync(req: Request, deps: GoogleDeps): Promise<Response> {
  const body = (await readJson(req)) ?? {}
  const limit = Math.min(200, Math.max(1, Number(body.limit) || 50))
  const notify = body.notify !== false
  const message =
    body.message && typeof body.message === 'object'
      ? (body.message as { header?: unknown; body?: unknown })
      : null
  const deadline = deps.now() + 20_000
  const result: SyncResult = { processed: 0, done: 0, retry: 0, failed: 0, gone: 0 }

  while (deps.now() < deadline) {
    const batch = (await deps.rpc('wallet_claim_updates', {
      p_provider: 'google',
      p_limit: limit,
    })) as ClaimedUpdate[] | null
    if (!batch || batch.length === 0) break

    for (const update of batch) {
      result.processed++
      const data = toPassData(update.pass)
      let error: string | null = null
      try {
        if (data) {
          const outcome = await deps.api.patchObject(data, notify)
          if (outcome === 'gone') result.gone++
          else if (
            message &&
            typeof message.header === 'string' &&
            typeof message.body === 'string'
          ) {
            await deps.api.addMessage(data, message.header, message.body, `sync_${update.updateId}`)
          }
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
        deps.log(`google sync update ${update.updateId} failed: ${error}`)
      }
      const state = await deps.rpc('wallet_finish_update', {
        p_update_id: update.updateId,
        p_revision: update.revision,
        p_error: error,
      })
      if (state === 'done' || state === 'requeued') result.done++
      else if (state === 'retry') result.retry++
      else if (state === 'failed') result.failed++
    }
    if (batch.length < limit) break
  }
  return json(result)
}
