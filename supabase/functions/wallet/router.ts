// Rutas de la Edge Function `wallet`. Todo lo externo (secrets, fetch, base de datos,
// firma de Apple) llega por parámetro: así se prueba sin credenciales reales.
import { readConfig, walletStatus, type Env } from './lib/config.ts'
import { createRpc, type Rpc } from './lib/db.ts'
import { corsHeaders, fail, json, safeEqual } from './lib/http.ts'
import { createGoogleApi, type GoogleApi } from './google/api.ts'
import { handleGoogleSave, handleGoogleSync } from './google/handlers.ts'
import { stampImageBase } from './lib/stamps.ts'
import { handleStampImage } from './stamps/handler.ts'
import {
  handleAppleDownload,
  handleAppleIssue,
  handleAppleSync,
  handleAppleWebService,
  type Signer,
} from './apple/handlers.ts'

export interface HandlerDeps {
  env: Env
  fetch?: typeof fetch
  rpc?: Rpc
  googleApi?: GoogleApi
  appleSigner?: Signer
  now?: () => number
  log?: (message: string) => void
}

/** "/wallet/google/sync" o "/functions/v1/wallet/google/sync" → ["google", "sync"]. */
export function routeSegments(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const index = parts.indexOf('wallet')
  return index === -1 ? parts : parts.slice(index + 1)
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const config = readConfig(deps.env)
  const fetchFn = deps.fetch ?? fetch
  const now = deps.now ?? (() => Date.now())
  const log = deps.log ?? ((message: string) => console.error(message))
  const rpc =
    deps.rpc ??
    (config.supabaseUrl && config.serviceKey
      ? createRpc(config.supabaseUrl, config.serviceKey, fetchFn)
      : null)
  const status = walletStatus(config)
  let googleApi = deps.googleApi ?? null

  const isSyncCaller = (req: Request) => {
    const given = req.headers.get('x-wallet-sync-secret') ?? ''
    return !!config.syncSecret && safeEqual(given, config.syncSecret)
  }

  async function route(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const [area, ...rest] = routeSegments(url.pathname)

    if (area === 'status' && req.method === 'GET') return json(status)

    if (area === 'stamps.png' && rest.length === 0) {
      if (req.method !== 'GET') return fail('method_not_allowed', 405)
      if (!rpc || !config.supabaseUrl) return fail('not_configured', 501)
      return await handleStampImage(url, {
        supabaseUrl: config.supabaseUrl,
        rpc,
        fetch: fetchFn,
        log,
      })
    }

    if (area === 'google') {
      if (!status.google || !rpc || !config.google || !config.supabaseUrl) {
        return fail('not_configured', 501)
      }
      googleApi ??= createGoogleApi(config.google, {
        fetch: fetchFn,
        now,
        stampImageBase: stampImageBase(config.supabaseUrl),
      })
      const googleDeps = {
        config: { ...config, google: config.google, supabaseUrl: config.supabaseUrl },
        rpc,
        api: googleApi,
        now,
        log,
      }
      if (rest.length === 0 && req.method === 'POST') return await handleGoogleSave(req, googleDeps)
      if (rest[0] === 'sync' && rest.length === 1 && req.method === 'POST') {
        if (!isSyncCaller(req)) return fail('unauthorized', 401)
        return await handleGoogleSync(req, googleDeps)
      }
      return fail('not_found', 404)
    }

    if (area === 'apple') {
      if (!status.apple || !rpc || !config.apple || !config.supabaseUrl) {
        return fail('not_configured', 501)
      }
      const apple = config.apple
      const appleDeps = {
        config: { ...config, apple, supabaseUrl: config.supabaseUrl },
        rpc,
        fetch: fetchFn,
        log,
        sign:
          deps.appleSigner ??
          (async (manifest: Uint8Array) => {
            // Se carga solo acá: sin Apple configurado, la función no necesita node-forge.
            const { signManifest } = await import('./apple/sign.ts')
            return signManifest(manifest, apple)
          }),
      }
      if (rest.length === 0 && req.method === 'POST') return await handleAppleIssue(req, appleDeps)
      if (rest[0] === 'download' && rest.length === 2 && req.method === 'GET') {
        return await handleAppleDownload(rest[1], url.searchParams.get('auth'), appleDeps)
      }
      if (rest[0] === 'sync' && rest.length === 1 && req.method === 'POST') {
        if (!isSyncCaller(req)) return fail('unauthorized', 401)
        return await handleAppleSync(appleDeps)
      }
      if (rest[0] === 'v1') return await handleAppleWebService(req, rest.slice(1), url, appleDeps)
      return fail('not_found', 404)
    }

    return fail('not_found', 404)
  }

  return async (req: Request) => {
    const cors = corsHeaders(req.headers.get('Origin'), config.allowedOrigins)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    let res: Response
    try {
      res = await route(req)
    } catch (error) {
      log(`wallet error: ${error instanceof Error ? error.message : String(error)}`)
      res = fail('server_error', 500)
    }
    const headers = new Headers(res.headers)
    for (const [k, v] of Object.entries(cors)) headers.set(k, v)
    return new Response(res.body, { status: res.status, headers })
  }
}
