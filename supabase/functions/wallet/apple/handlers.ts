// Apple Wallet (requiere cuenta paga de Apple Developer; ver docs/WALLET.md).
//
//   POST   /wallet/apple                       → link de descarga del .pkpass
//   GET    /wallet/apple/download/:serial?auth → el .pkpass firmado
//   POST   /wallet/apple/sync                  → avisos pendientes (APNs: TODO)
//   Web service de PassKit (lo llama el iPhone; base = webServiceURL del pase):
//   POST   /wallet/apple/v1/devices/:device/registrations/:passTypeId/:serial
//   GET    /wallet/apple/v1/devices/:device/registrations/:passTypeId?passesUpdatedSince=
//   GET    /wallet/apple/v1/passes/:passTypeId/:serial
//   DELETE /wallet/apple/v1/devices/:device/registrations/:passTypeId/:serial
//   POST   /wallet/apple/v1/log
import type { AppleConfig, Config } from '../lib/config.ts'
import { randomHex, sha256Hex, type Rpc } from '../lib/db.ts'
import { CARD_TOKEN, fail, json, readJson } from '../lib/http.ts'
import { toPassData, type PassData } from '../lib/passData.ts'
import { brandColor, isPng, publicLogoUrl } from '../lib/text.ts'
import { buildManifest, buildPassJson, encodeJson, type PassFiles } from './pass.ts'
import { solidPng } from './png.ts'
import { zipStored } from './zip.ts'

export type Signer = (manifest: Uint8Array) => Promise<Uint8Array> | Uint8Array

export interface AppleDeps {
  config: Config & { apple: AppleConfig; supabaseUrl: string }
  rpc: Rpc
  fetch: typeof fetch
  sign: Signer
  log: (message: string) => void
}

export function webServiceUrl(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/wallet/apple`
}

/** Arma el .pkpass: archivos + manifest.json (SHA-1) + signature, en un zip. */
export async function buildPkpass(
  data: PassData,
  apple: Pick<AppleConfig, 'passTypeId' | 'teamId'>,
  options: { webServiceUrl: string; authenticationToken: string; images: PassFiles },
  sign: Signer,
): Promise<Uint8Array> {
  const passJson = buildPassJson(data, {
    passTypeId: apple.passTypeId,
    teamId: apple.teamId,
    webServiceUrl: options.webServiceUrl,
    authenticationToken: options.authenticationToken,
  })
  const files: PassFiles = { 'pass.json': encodeJson(passJson), ...options.images }
  const manifest = encodeJson(await buildManifest(files))
  const signature = await sign(manifest)
  return zipStored({ ...files, 'manifest.json': manifest, signature })
}

/** Imágenes del pase: el logo del negocio si es PNG; si no, un ícono del color de la marca. */
async function passImages(deps: AppleDeps, data: PassData): Promise<PassFiles> {
  const brand = brandColor(data.business.primaryColor)
  const images: PassFiles = {
    'icon.png': await solidPng(29, 29, brand),
    'icon@2x.png': await solidPng(58, 58, brand),
  }
  const url = isPng(data.business.logoPath)
    ? publicLogoUrl(deps.config.supabaseUrl, data.business.logoPath)
    : null
  if (!url) return images
  try {
    const res = await deps.fetch(url, { signal: AbortSignal.timeout(5000) })
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (res.ok && bytes.length > 0 && bytes.length <= 1024 * 1024) {
      images['logo.png'] = bytes
      images['logo@2x.png'] = bytes
    }
  } catch (error) {
    deps.log(`apple logo fetch failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  return images
}

async function pkpassResponse(
  deps: AppleDeps,
  data: PassData,
  authToken: string,
): Promise<Response> {
  const bytes = await buildPkpass(
    data,
    deps.config.apple,
    {
      webServiceUrl: webServiceUrl(deps.config.supabaseUrl),
      authenticationToken: authToken,
      images: await passImages(deps, data),
    },
    deps.sign,
  )
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': 'attachment; filename="tarjeta.pkpass"',
      'Last-Modified': new Date(data.updatedAt).toUTCString(),
      'Cache-Control': 'no-store',
    },
  })
}

export async function handleAppleIssue(req: Request, deps: AppleDeps): Promise<Response> {
  const body = await readJson(req)
  const token = typeof body?.token === 'string' ? body.token.trim().toLowerCase() : ''
  if (!CARD_TOKEN.test(token)) return fail('invalid_token', 400)

  // Token nuevo en cada descarga: el pase nuevo reemplaza al anterior en el iPhone.
  const authToken = randomHex(32)
  const data = toPassData(
    await deps.rpc('wallet_issue_pass', {
      p_card_token: token,
      p_provider: 'apple',
      p_auth_token_hash: await sha256Hex(authToken),
    }),
  )
  if (!data) return fail('card_not_found', 404)
  const url = `${webServiceUrl(deps.config.supabaseUrl)}/download/${encodeURIComponent(data.objectId)}?auth=${authToken}`
  return json({ url })
}

export async function handleAppleDownload(
  serial: string,
  authToken: string | null,
  deps: AppleDeps,
): Promise<Response> {
  if (!authToken || authToken.length < 16) return fail('unauthorized', 401)
  const data = toPassData(
    await deps.rpc('wallet_apple_pass', {
      p_serial: serial,
      p_auth_token_hash: await sha256Hex(authToken),
    }),
  )
  if (!data) return fail('not_found', 404)
  return await pkpassResponse(deps, data, authToken)
}

/** "Authorization: ApplePass <token>" → token. */
export function applePassToken(req: Request): string | null {
  const match = /^ApplePass\s+(\S{16,})$/.exec(req.headers.get('Authorization') ?? '')
  return match ? match[1] : null
}

/** Rutas del web service de PassKit. `path` es lo que sigue a /apple/v1. */
export async function handleAppleWebService(
  req: Request,
  path: string[],
  url: URL,
  deps: AppleDeps,
): Promise<Response> {
  const passTypeId = deps.config.apple.passTypeId
  const empty = (status: number) => new Response(null, { status })

  if (path[0] === 'log' && req.method === 'POST') {
    const body = await readJson(req)
    const logs = Array.isArray(body?.logs) ? body.logs.slice(0, 20) : []
    for (const line of logs) deps.log(`apple wallet log: ${String(line).slice(0, 300)}`)
    return empty(200)
  }

  // /devices/:device/registrations/:passTypeId[/:serial]
  if (path[0] === 'devices' && path[2] === 'registrations' && path.length >= 4) {
    const device = path[1]
    if (path[3] !== passTypeId) return empty(404)
    const serial = path[4]

    if (!serial && req.method === 'GET') {
      const since = url.searchParams.get('passesUpdatedSince')
      const sinceDate = since && !Number.isNaN(Date.parse(since)) ? since : null
      const result = (await deps.rpc('wallet_apple_serials', {
        p_device_id: device,
        p_since: sinceDate,
      })) as { serialNumbers: string[]; lastUpdated: string | null } | null
      if (!result || result.serialNumbers.length === 0) return empty(204)
      return json({ serialNumbers: result.serialNumbers, lastUpdated: result.lastUpdated })
    }

    if (serial) {
      const token = applePassToken(req)
      if (!token) return empty(401)
      const hash = await sha256Hex(token)
      if (req.method === 'POST') {
        const body = await readJson(req)
        const pushToken = typeof body?.pushToken === 'string' ? body.pushToken : ''
        if (!pushToken) return empty(400)
        const state = await deps.rpc('wallet_apple_register', {
          p_serial: serial,
          p_auth_token_hash: hash,
          p_device_id: device,
          p_push_token: pushToken,
        })
        return empty(state === 'created' ? 201 : state === 'exists' ? 200 : 401)
      }
      if (req.method === 'DELETE') {
        const state = await deps.rpc('wallet_apple_unregister', {
          p_serial: serial,
          p_auth_token_hash: hash,
          p_device_id: device,
        })
        return empty(state === 'deleted' ? 200 : 401)
      }
    }
    return empty(405)
  }

  // /passes/:passTypeId/:serial
  if (path[0] === 'passes' && path.length === 3 && req.method === 'GET') {
    if (path[1] !== passTypeId) return empty(404)
    const token = applePassToken(req)
    if (!token) return empty(401)
    const data = toPassData(
      await deps.rpc('wallet_apple_pass', {
        p_serial: path[2],
        p_auth_token_hash: await sha256Hex(token),
      }),
    )
    if (!data) return empty(401)
    const since = Date.parse(req.headers.get('If-Modified-Since') ?? '')
    if (
      !Number.isNaN(since) &&
      Math.floor(Date.parse(data.updatedAt) / 1000) <= Math.floor(since / 1000)
    ) {
      return empty(304)
    }
    return await pkpassResponse(deps, data, token)
  }

  return empty(404)
}

/**
 * Avisos pendientes de Apple. El aviso real es un push vacío por APNs al pushToken de
 * cada iPhone (topic = Pass Type ID); el iPhone después pide el pase nuevo.
 * TODO(apns): implementar el envío HTTP/2 a api.push.apple.com con el certificado del
 * Pass Type ID cuando exista la cuenta de Apple. Mientras tanto se cierran los avisos:
 * el pase ya quedó con fecha nueva y el iPhone lo baja al actualizarlo a mano.
 */
export async function handleAppleSync(deps: AppleDeps): Promise<Response> {
  const batch = (await deps.rpc('wallet_claim_updates', { p_provider: 'apple', p_limit: 200 })) as
    | { updateId: number; revision: number }[]
    | null
  for (const update of batch ?? []) {
    await deps.rpc('wallet_finish_update', {
      p_update_id: update.updateId,
      p_revision: update.revision,
      p_error: null,
    })
  }
  return json({ processed: batch?.length ?? 0, pushed: 0, apns: 'not_implemented' })
}
