// Tarjeta de sellos en el pase (docs/WALLET.md, "Tarjeta de sellos"). Funciones puras.
// Misma regla que card.stampSlots() / card.showsStamps() del SDK (packages/sdk/src/card.ts).
import type { PassData } from './passData.ts'
import { brandColor } from './text.ts'

export const MAX_STAMPS = 20

export interface StampView {
  /** Casilleros que se dibujan (1..MAX_STAMPS). */
  total: number
  /** Casilleros llenos (0..total). */
  filled: number
}

/**
 * Casilleros del pase, o null si el pase no se dibuja como tarjeta de sellos
 * (sin recompensas, inactivo, o programa de puntos con recompensas de más de 20).
 */
export function stampView(
  data: Pick<PassData, 'active' | 'programKind' | 'stampGoal' | 'pointsBalance'>,
): StampView | null {
  const goal = data.stampGoal
  if (!data.active || goal === null || !Number.isFinite(goal) || goal < 1) return null
  if (data.programKind !== 'stamps' && goal > MAX_STAMPS) return null
  const progress = Math.min(Math.max(0, Math.trunc(data.pointsBalance)), goal)
  const total = Math.min(goal, MAX_STAMPS)
  const filled = progress >= goal ? total : Math.floor((progress * total) / goal)
  return { total, filled }
}

/**
 * Versión de la marca (logo + color) para la URL de la imagen: si el negocio cambia
 * el logo o el color, cambia la URL y Google vuelve a bajar la imagen.
 * FNV-1a de 32 bits: no es un secreto, solo una huella corta y estable.
 */
export function brandVersion(logoPath: string | null, primaryColor: string | null): string {
  const text = `${logoPath ?? ''}|${brandColor(primaryColor)}`
  let hash = 0x811c9dc5
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** `${SUPABASE_URL}/functions/v1/wallet/stamps.png` */
export function stampImageBase(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/wallet/stamps.png`
}

/** URL pública e inmutable de la imagen de sellos de un pase (null si no corresponde). */
export function stampImageUrl(base: string, data: PassData): string | null {
  const view = stampView(data)
  if (!view) return null
  const params = new URLSearchParams({
    b: data.businessId,
    n: String(view.filled),
    t: String(view.total),
    v: brandVersion(data.business.logoPath, data.business.primaryColor),
  })
  return `${base}?${params}`
}

export interface StampImageParams {
  businessId: string
  filled: number
  total: number
  version: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const INTEGER = /^(0|[1-9]\d{0,2})$/

/** Valida ?b=&n=&t=&v= (t entre 1 y 20, n entre 0 y t). null si algo no cierra. */
export function parseStampParams(params: URLSearchParams): StampImageParams | null {
  const b = (params.get('b') ?? '').toLowerCase()
  const n = params.get('n') ?? ''
  const t = params.get('t') ?? ''
  const v = params.get('v') ?? ''
  if (!UUID.test(b) || !INTEGER.test(n) || !INTEGER.test(t) || !/^[0-9a-f]{8}$/.test(v)) return null
  const filled = Number(n)
  const total = Number(t)
  if (total < 1 || total > MAX_STAMPS || filled > total) return null
  return { businessId: b, filled, total, version: v }
}
