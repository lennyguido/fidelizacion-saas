// Opiniones de los clientes y link de reseñas de Google (D-036, núcleo).
// Las opiniones las deja el cliente desde su tarjeta; acá el dueño las lee.
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

const REVIEW_URL =
  /^https:\/\/(g\.page|(www\.)?google\.(com|com\.[a-z]{2}|[a-z]{2})|maps\.app\.goo\.gl|search\.google\.com)\//i

/** Solo links de Google (lo mismo que exige la base). */
export function isValidReviewUrl(url: string): boolean {
  return url.length <= 500 && REVIEW_URL.test(url.trim())
}

export async function getReviewUrl(businessId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('businesses')
    .select('google_review_url')
    .eq('id', businessId)
    .single()
  if (error) throw fromPostgrestError(error)
  return data.google_review_url
}

/** Solo dueño/admin. Vacío = sin link. */
export async function saveReviewUrl(businessId: string, url: string): Promise<void> {
  const value = url.trim() === '' ? null : url.trim()
  const { error } = await getSupabase()
    .from('businesses')
    .update({ google_review_url: value })
    .eq('id', businessId)
  if (error) throw fromPostgrestError(error)
}

export interface Feedback {
  id: string
  customerId: string
  customerName: string
  rating: number
  comment: string | null
  createdAt: string
}

/** Opiniones de los últimos 30 días, las más nuevas primero (solo dueño/admin). */
export async function listRecent(businessId: string): Promise<Feedback[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await getSupabase()
    .from('feedback')
    .select('id, customer_id, rating, comment, created_at')
    .eq('business_id', businessId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw fromPostgrestError(error)
  const rows = data ?? []
  const ids = [...new Set(rows.map((row) => row.customer_id))]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const customers = await getSupabase().from('customers').select('id, name').in('id', ids)
    if (customers.error) throw fromPostgrestError(customers.error)
    for (const customer of customers.data ?? []) names.set(customer.id, customer.name)
  }
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: names.get(row.customer_id) ?? '—',
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  }))
}

/** Con 3 o menos es un aviso privado para el dueño. */
export function isLowRating(rating: number): boolean {
  return rating <= 3
}
