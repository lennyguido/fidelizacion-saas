// Recuperación automática (D-031). La base elige a quién escribir, arma las
// campañas del día y deja los mensajes en la cola; acá solo se llaman funciones.
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'
import type { FunctionReturns } from './tables.ts'

export type AutomationKind = 'at_risk' | 'second_visit' | 'birthday'

export const AUTOMATION_KINDS: AutomationKind[] = ['at_risk', 'second_visit', 'birthday']

export interface Automation {
  kind: AutomationKind
  enabled: boolean
  /**
   * En riesgo: mínimo de días sin venir. Segunda visita: días después de la
   * primera. Cumpleaños: días de anticipación.
   */
  days: number
  message: string
  benefit: string | null
  controlPct: number
  attributionDays: number
  updatedAt: string | null
}

export type AutomationInput = Omit<Automation, 'kind' | 'updatedAt'>

/** Rango de días que acepta la base para cada automatización. */
export const AUTOMATION_DAYS: Record<AutomationKind, { min: number; max: number }> = {
  at_risk: { min: 7, max: 180 },
  second_visit: { min: 3, max: 60 },
  birthday: { min: 0, max: 14 },
}

export async function list(businessId: string): Promise<Automation[]> {
  const { data, error } = await getSupabase().rpc('list_automations', {
    p_business_id: businessId,
  })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row: FunctionReturns<'list_automations'>[number]) => ({
    kind: row.kind as AutomationKind,
    enabled: row.enabled,
    days: row.days,
    message: row.message,
    benefit: row.benefit,
    controlPct: row.control_pct,
    attributionDays: row.attribution_days,
    updatedAt: row.updated_at,
  }))
}

export async function save(
  businessId: string,
  kind: AutomationKind,
  input: AutomationInput,
): Promise<void> {
  const { error } = await getSupabase().rpc('set_automation', {
    p_business_id: businessId,
    p_kind: kind,
    p_enabled: input.enabled,
    p_days: input.days,
    p_message: input.message,
    p_benefit: input.benefit ?? undefined,
    p_control_pct: input.controlPct,
    p_attribution_days: input.attributionDays,
  })
  if (error) throw fromPostgrestError(error)
}

/** "Revisar ahora": prepara los mensajes de hoy (si ya se prepararon, no hace nada). */
export async function runNow(businessId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('run_business_automations', {
    p_business_id: businessId,
  })
  if (error) throw fromPostgrestError(error)
  return data ?? 0
}

// Mensajes listos (core.outbox) ---------------------------------------------------------

/** Por qué ya no hay que escribirle (se dio de baja o se archivó). */
export type OutboxBlockedReason = 'consent_revoked' | 'customer_inactive'

export interface OutboxMessage {
  id: string
  campaignId: string
  automationKind: AutomationKind | null
  customerId: string
  name: string
  /** null si está bloqueado: no hay que escribirle. */
  phone: string | null
  message: string | null
  createdAt: string
  blockedReason: OutboxBlockedReason | null
}

export async function listReady(businessId: string): Promise<OutboxMessage[]> {
  const { data, error } = await getSupabase().rpc('list_outbox', {
    p_business_id: businessId,
    p_status: 'manual',
  })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row: FunctionReturns<'list_outbox'>[number]) => ({
    id: row.outbox_id,
    campaignId: row.campaign_id,
    automationKind: (row.automation_kind as AutomationKind | null) ?? null,
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    message: row.message,
    createdAt: row.created_at,
    blockedReason: (row.blocked_reason as OutboxBlockedReason | null) ?? null,
  }))
}

/** Cuántos mensajes esperan que el dueño los mande (para la tarjeta de Inicio). */
export async function countReady(businessId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('outbox')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'manual')
  if (error) throw fromPostgrestError(error)
  return count ?? 0
}

export async function markSent(outboxId: string): Promise<void> {
  const { error } = await getSupabase().rpc('mark_outbox_sent', { p_outbox_id: outboxId })
  if (error) throw fromPostgrestError(error)
}

export async function discard(outboxId: string): Promise<void> {
  const { error } = await getSupabase().rpc('discard_outbox', { p_outbox_id: outboxId })
  if (error) throw fromPostgrestError(error)
}
