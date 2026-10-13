// Carteles NFC/QR de reseñas (D-048, módulo `reputation`).
// El chip y el QR llevan a neriva.net/r/<código>: se cuenta el toque y se redirige
// al destino (por defecto, el link de reseñas de Google del negocio).
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

function db() {
  return getSupabase().schema('reputation')
}

export interface ReviewTag {
  id: string
  code: string
  label: string
  destination: string
  active: boolean
  createdAt: string
  tapsThisMonth: number
  tapsLastMonth: number
  tapsTotal: number
  lastTapAt: string | null
}

/** Dominio de los links cortos. Se graba en los chips: no cambiarlo. */
export const SHORT_LINK_BASE = 'https://neriva.net/r/'

/** Link que se graba en el chip NFC (o el del QR impreso, que se cuenta aparte). */
export function tagLink(code: string, via: 'nfc' | 'qr' = 'nfc'): string {
  return `${SHORT_LINK_BASE}${code}${via === 'qr' ? '?s=q' : ''}`
}

export async function listTags(businessId: string): Promise<ReviewTag[]> {
  const [tags, stats] = await Promise.all([
    db()
      .from('tags')
      .select('id, code, label, destination, active, created_at')
      .eq('business_id', businessId)
      .order('created_at'),
    db().rpc('tag_stats', { p_business_id: businessId }),
  ])
  if (tags.error) throw fromPostgrestError(tags.error)
  if (stats.error) throw fromPostgrestError(stats.error)
  const byTag = new Map((stats.data ?? []).map((row) => [row.tag_id, row]))
  return (tags.data ?? []).map((tag) => {
    const s = byTag.get(tag.id)
    return {
      id: tag.id,
      code: tag.code,
      label: tag.label,
      destination: tag.destination,
      active: tag.active,
      createdAt: tag.created_at,
      tapsThisMonth: Number(s?.taps_this_month ?? 0),
      tapsLastMonth: Number(s?.taps_last_month ?? 0),
      tapsTotal: Number(s?.taps_total ?? 0),
      lastTapAt: s?.last_tap_at ?? null,
    }
  })
}

/** Destino vacío = el link de reseñas de Google del negocio. */
export async function createTag(
  businessId: string,
  label: string,
  destination: string | null,
): Promise<void> {
  const { error } = await db().rpc('create_tag', {
    p_business_id: businessId,
    p_label: label,
    p_destination: destination ?? '',
  })
  if (error) throw fromPostgrestError(error)
}

export async function updateTag(
  tagId: string,
  changes: { label?: string; destination?: string; active?: boolean },
): Promise<void> {
  // Lo que no viene no se manda: la base deja ese dato como estaba.
  const { error } = await db().rpc('update_tag', {
    p_tag_id: tagId,
    ...(changes.label !== undefined && { p_label: changes.label }),
    ...(changes.destination !== undefined && { p_destination: changes.destination }),
    ...(changes.active !== undefined && { p_active: changes.active }),
  })
  if (error) throw fromPostgrestError(error)
}
