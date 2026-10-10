// GET /wallet/stamps.png?b=<business_id>&n=<llenos>&t=<total>&v=<versión de la marca>
//
// Imagen pública de la fila de sellos (Google Wallet la usa como heroImage del pase).
// No lleva datos del cliente: solo color y logo del negocio, que ya son públicos (D-024).
// La URL cambia con cada dato, así que se guarda en caché "para siempre" (immutable).
import type { Rpc } from '../lib/db.ts'
import { fail } from '../lib/http.ts'
import { fetchLogoPng } from '../lib/logo.ts'
import { decodePng } from '../lib/png.ts'
import { GOOGLE_HERO_SIZE, stampPng } from '../lib/stampImage.ts'
import { brandVersion, parseStampParams } from '../lib/stamps.ts'
import { isPng } from '../lib/text.ts'

export interface StampDeps {
  supabaseUrl: string
  rpc: Rpc
  fetch: typeof fetch
  log: (message: string) => void
}

export const IMMUTABLE = 'public, max-age=31536000, immutable'
/** Si la versión de la URL ya no es la de la marca, se sirve igual pero por poco tiempo. */
export const SHORT_CACHE = 'public, max-age=300'

// Caché en memoria de la instancia (pocas combinaciones posibles por negocio).
const memory = new Map<string, Uint8Array>()
const MEMORY_LIMIT = 64

export async function handleStampImage(url: URL, deps: StampDeps): Promise<Response> {
  const params = parseStampParams(url.searchParams)
  if (!params) return fail('bad_request', 400)

  const brand = (await deps.rpc('wallet_stamp_brand', { p_business_id: params.businessId })) as {
    primaryColor?: unknown
    logoPath?: unknown
  } | null
  if (!brand) return fail('not_found', 404)
  const color = typeof brand.primaryColor === 'string' ? brand.primaryColor : null
  const logoPath = typeof brand.logoPath === 'string' ? brand.logoPath : null
  const current = brandVersion(logoPath, color) === params.version

  const key = `${params.businessId}:${params.filled}:${params.total}:${brandVersion(logoPath, color)}`
  let png = memory.get(key)
  // Si el logo PNG no se pudo bajar o leer, se dibuja el tilde pero sin caché larga:
  // así la próxima vez se vuelve a intentar con el logo.
  let complete = true
  if (!png) {
    const logoBytes = await fetchLogoPng(deps.fetch, deps.supabaseUrl, logoPath, deps.log)
    const logo = logoBytes ? await decodePng(logoBytes) : null
    complete = !isPng(logoPath) || logo !== null
    png = await stampPng({
      ...GOOGLE_HERO_SIZE,
      total: params.total,
      filled: params.filled,
      color,
      logo,
    })
    if (complete) {
      if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value!)
      memory.set(key, png)
    }
  }

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': current && complete ? IMMUTABLE : SHORT_CACHE,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/** Solo para los tests. */
export function clearStampCache() {
  memory.clear()
}
