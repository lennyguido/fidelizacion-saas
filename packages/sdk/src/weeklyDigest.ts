// Resumen de los lunes para el dueño (D-035). Postgres calcula todo; acá solo se
// traen los datos y se arma el texto para mandárselo por WhatsApp.
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

export type DigestActionKind =
  | 'load_visits'
  | 'review_alerts'
  | 'contact_at_risk'
  | 'turn_on_automations'
  | 'ask_phone'
  | 'keep_going'

export interface DigestAction {
  kind: DigestActionKind
  /** Solo en `contact_at_risk`. */
  customerId?: string
  name?: string
}

export interface AtRiskRegular {
  customerId: string
  name: string
  phone: string | null
  visitCount: number
  lastVisitAt: string | null
}

export interface SameStaffAlert {
  customerId: string
  customerName: string
  staffEmail: string | null
  visits: number
}

export interface WeeklyDigest {
  /** Lunes y domingo de la semana (AAAA-MM-DD, hora del negocio). */
  weekStart: string
  weekEnd: string
  businessPhone: string | null
  visits: number
  identifiedVisits: number
  /** Promedio semanal de las semanas anteriores; null si hay menos de 4 para comparar. */
  baselineVisits: number | null
  baselineWeeks: number
  visitsDropAlert: boolean
  newCustomers: number
  recoveredCustomers: number
  atRiskRegulars: AtRiskRegular[]
  sameStaffAlerts: SameStaffAlert[]
  voids: number
  voidsAlert: boolean
  action: DigestAction
}

/** Última semana completa (lunes a domingo). Solo dueño/admin. */
export async function get(businessId: string): Promise<WeeklyDigest> {
  const { data, error } = await getSupabase().rpc('weekly_digest', { p_business_id: businessId })
  if (error) throw fromPostgrestError(error)
  const raw = data as unknown as WeeklyDigest
  return {
    ...raw,
    baselineVisits: raw.baselineVisits === null ? null : Number(raw.baselineVisits),
  }
}

/** Texto corto de la acción sugerida. */
export function actionText(action: DigestAction): string {
  switch (action.kind) {
    case 'load_visits':
      return 'Esta semana no se registraron visitas. Registrá cada venta en el Mostrador.'
    case 'review_alerts':
      return 'Revisá las alertas: hay movimientos fuera de lo normal.'
    case 'contact_at_risk':
      return `Escribile a ${action.name ?? 'tu cliente'}: venía seguido y dejó de venir.`
    case 'turn_on_automations':
      return 'Bajaron las visitas. Prendé la recuperación automática para volver a llamar a quienes dejaron de venir.'
    case 'ask_phone':
      return 'Más de la mitad de las visitas no tienen cliente. Pedí el celular en la caja.'
    case 'keep_going':
      return 'Todo en orden. ¡Seguí así!'
  }
}

/** "5/10" a partir de "2026-10-05". */
function dayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${Number(day)}/${Number(month)}`
}

/** Mensaje para "Mandármelo por WhatsApp". */
export function whatsappText(digest: WeeklyDigest, businessName: string): string {
  const lines = [
    `Resumen de ${businessName} (${dayMonth(digest.weekStart)} al ${dayMonth(digest.weekEnd)})`,
    `• Visitas: ${digest.visits}` +
      (digest.baselineVisits !== null ? ` (lo normal: ${Math.round(digest.baselineVisits)})` : ''),
    `• Clientes nuevos: ${digest.newCustomers}`,
    `• Recuperados: ${digest.recoveredCustomers}`,
  ]
  if (digest.visitsDropAlert) lines.push('⚠️ Las visitas bajaron más de 20 %.')
  if (digest.atRiskRegulars.length > 0) {
    lines.push(`• En riesgo: ${digest.atRiskRegulars.map((c) => c.name).join(', ')}`)
  }
  if (digest.sameStaffAlerts.length > 0 || digest.voidsAlert) {
    lines.push('⚠️ Hay alertas para revisar en el panel.')
  }
  lines.push(`👉 ${actionText(digest.action)}`)
  return lines.join('\n')
}
