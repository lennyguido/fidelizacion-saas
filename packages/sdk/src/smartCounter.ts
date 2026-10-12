// Mostrador inteligente (D-038). Postgres calcula todo; acá solo se leen los datos
// y se arman los textos cortos.
import { getSupabase } from './client.ts'
import type { CustomerStatus } from './customers.ts'
import { fromPostgrestError } from './errors.ts'

export interface CustomerSnapshot {
  customerId: string
  name: string
  customerSince: string
  visitCount: number
  /** Qué número de visita sería la de hoy. */
  nextVisitNumber: number
  /** Cada cuántos días viene (null si todavía no se sabe). */
  medianIntervalDays: number | null
  lastVisitAt: string | null
  status: CustomerStatus | null
  note: string | null
  /** Lo que gastó en total, solo con montos cargados y solo para dueño/admin. */
  totalSpendMinor: number | null
}

export async function snapshot(customerId: string): Promise<CustomerSnapshot> {
  const { data, error } = await getSupabase().rpc('customer_snapshot', {
    p_customer_id: customerId,
  })
  if (error) throw fromPostgrestError(error)
  const raw = data as unknown as CustomerSnapshot
  return {
    ...raw,
    medianIntervalDays: raw.medianIntervalDays === null ? null : Number(raw.medianIntervalDays),
    totalSpendMinor: raw.totalSpendMinor === null ? null : Number(raw.totalSpendMinor),
  }
}

/** "hace 2 años", "hace 3 meses", "hace 5 días", "hoy". */
export function sinceText(iso: string, now: number = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'desde hoy'
  if (days < 60) return `hace ${days} ${days === 1 ? 'día' : 'días'}`
  const months = Math.floor(days / 30.4)
  if (months < 24) return `hace ${months} meses`
  return `hace ${Math.floor(days / 365.25)} años`
}

/** "hace 2 años · visita 50 · viene cada ~9 días". */
export function snapshotLine(snap: CustomerSnapshot, now: number = Date.now()): string {
  const parts = [sinceText(snap.customerSince, now), `visita ${snap.nextVisitNumber}`]
  if (snap.medianIntervalDays !== null && snap.medianIntervalDays > 0) {
    parts.push(`viene cada ~${snap.medianIntervalDays} días`)
  }
  return parts.join(' · ')
}

export interface TeamMemberWeek {
  userId: string
  email: string
  role: 'owner' | 'admin' | 'staff'
  isMe: boolean
  /** null cuando un empleado mira los números de otro. */
  visits: number | null
  newCustomers: number | null
}

/** Ranking del equipo de esta semana (lunes a hoy, hora del negocio). */
export async function teamWeek(businessId: string): Promise<TeamMemberWeek[]> {
  const { data, error } = await getSupabase().rpc('team_week_stats', { p_business_id: businessId })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role as TeamMemberWeek['role'],
    isMe: row.is_me,
    visits: row.visits,
    newCustomers: row.new_customers,
  }))
}

export interface TopCustomer {
  customerId: string
  name: string
  visits: number
  /** null si no hay montos cargados. */
  spendMinor: number | null
  lastVisitAt: string
}

/** Los 10 que más vinieron en 90 días (dueño/admin). */
export async function topCustomers(businessId: string): Promise<TopCustomer[]> {
  const { data, error } = await getSupabase().rpc('top_customers', { p_business_id: businessId })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    customerId: row.customer_id,
    name: row.name,
    visits: row.visits,
    spendMinor: row.spend_minor === null ? null : Number(row.spend_minor),
    lastVisitAt: row.last_visit_at,
  }))
}
