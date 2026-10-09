import { getSupabase } from './client.ts'
import type { CustomerStatus } from './customers.ts'
import { fromPostgrestError } from './errors.ts'

export interface DashboardSummary {
  monthStart: string
  visits: number
  visitsPrev: number
  identifiedVisits: number
  revenueMinor: number
  revenuePrevMinor: number
  avgTicketMinor: number | null
  newCustomers: number
  recoveredCustomers: number
  statusCounts: Partial<Record<CustomerStatus, number>>
  /** Lo que gastaron en total los clientes en riesgo o inactivos (lo que está en juego). */
  atRiskValueMinor: number
  recentVisits: Array<{
    occurredAt: string
    amountMinor: number | null
    customerName: string | null
  }>
}

/** Tablero del mes en curso vs. el mismo período del mes anterior. Solo dueño/admin. */
export async function summary(businessId: string): Promise<DashboardSummary> {
  const { data, error } = await getSupabase().rpc('dashboard_summary', {
    p_business_id: businessId,
  })
  if (error) throw fromPostgrestError(error)
  const raw = data as unknown as DashboardSummary
  return {
    ...raw,
    revenueMinor: Number(raw.revenueMinor),
    revenuePrevMinor: Number(raw.revenuePrevMinor),
    avgTicketMinor: raw.avgTicketMinor === null ? null : Number(raw.avgTicketMinor),
    atRiskValueMinor: Number(raw.atRiskValueMinor),
  }
}

/** Variación porcentual redondeada; null si no hay base para comparar. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
