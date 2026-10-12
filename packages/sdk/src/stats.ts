// Estadísticas del dueño (D-042). Postgres calcula todo (core.business_stats); acá
// solo se leen los datos y se agrupan los orígenes para mostrarlos.
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

export const STATS_RANGES = [7, 30, 90, 180, 365] as const
export type StatsRange = (typeof STATS_RANGES)[number]

export interface StatsTotals {
  visits: number
  visitsPrev: number
  customers: number
  customersPrev: number
  identified: number
  identifiedPrev: number
  avgTicketMinor: number | null
  avgTicketPrevMinor: number | null
  revenueMinor: number
  revenuePrevMinor: number
}

export interface StatsDay {
  day: string
  visits: number
  customers: number
  identified: number
  avgTicketMinor: number | null
}

/** Grupos de origen que se muestran (los de la base se juntan en estos). */
export type SourceGroup = 'counter' | 'qr' | 'register' | 'other'

export const SOURCE_GROUPS: SourceGroup[] = ['counter', 'qr', 'register', 'other']

export const SOURCE_GROUP_LABELS: Record<SourceGroup, string> = {
  counter: 'Mostrador',
  qr: 'Código QR',
  register: 'Caja',
  other: 'Otros',
}

export function sourceGroup(source: string): SourceGroup {
  if (source === 'manual') return 'counter'
  if (source === 'qr_customer' || source === 'qr_business') return 'qr'
  if (source === 'pos' || source === 'mercadopago') return 'register'
  return 'other'
}

export type WeekRow = { week: string } & Record<SourceGroup, number>

export interface BusinessStats {
  from: string
  to: string
  days: number
  totals: StatsTotals
  daily: StatsDay[]
  weekly: WeekRow[]
  newVsReturning: { new: number; returning: number }
  byWeekday: Array<{ weekday: number; visits: number }>
}

interface RawStats extends Omit<BusinessStats, 'weekly'> {
  weeklyBySource: Array<{ week: string; source: string; visits: number }>
}

/** Junta las visitas por semana en los grupos de origen (filas listas para el gráfico). */
export function groupWeekly(rows: RawStats['weeklyBySource']): WeekRow[] {
  const byWeek = new Map<string, WeekRow>()
  for (const row of rows) {
    const current = byWeek.get(row.week) ?? {
      week: row.week,
      counter: 0,
      qr: 0,
      register: 0,
      other: 0,
    }
    current[sourceGroup(row.source)] += row.visits
    byWeek.set(row.week, current)
  }
  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week))
}

const num = (value: unknown): number | null => (value === null ? null : Number(value))

export async function get(businessId: string, days: StatsRange): Promise<BusinessStats> {
  const { data, error } = await getSupabase().rpc('business_stats', {
    p_business_id: businessId,
    p_days: days,
  })
  if (error) throw fromPostgrestError(error)
  const raw = data as unknown as RawStats
  return {
    from: raw.from,
    to: raw.to,
    days: raw.days,
    totals: {
      ...raw.totals,
      avgTicketMinor: num(raw.totals.avgTicketMinor),
      avgTicketPrevMinor: num(raw.totals.avgTicketPrevMinor),
      revenueMinor: Number(raw.totals.revenueMinor),
      revenuePrevMinor: Number(raw.totals.revenuePrevMinor),
    },
    daily: raw.daily.map((d) => ({ ...d, avgTicketMinor: num(d.avgTicketMinor) })),
    weekly: groupWeekly(raw.weeklyBySource),
    newVsReturning: {
      new: Number(raw.newVsReturning?.new ?? 0),
      returning: Number(raw.newVsReturning?.returning ?? 0),
    },
    byWeekday: raw.byWeekday,
  }
}

/** Variación % contra el período anterior; null si no hay base para comparar. */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
