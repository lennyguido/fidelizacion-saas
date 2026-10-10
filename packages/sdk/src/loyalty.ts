// Módulo Fidelización (esquema `loyalty`). Las reglas viven en la base (D-018):
// acá solo se leen datos y se llaman funciones.
import { getSupabase } from './client.ts'
import type { Database } from './database.types.ts'
import { fromPostgrestError } from './errors.ts'

type Loyalty = Database['loyalty']
type Row<T extends keyof Loyalty['Tables']> = Loyalty['Tables'][T]['Row']

function db() {
  return getSupabase().schema('loyalty')
}

// Programa ------------------------------------------------------------------------

export type ProgramKind = 'points' | 'stamps'

/** La regla que ve el cliente (sin los topes internos). */
export interface ProgramRule {
  enabled: boolean
  kind: ProgramKind
  pointsPerVisit: number
  pointsPerAmount: number
  /** Cada cuánto dinero (unidades menores) se dan `pointsPerAmount` puntos. */
  amountStepMinor: number | null
  minAmountMinor: number
}

export interface Program extends ProgramRule {
  businessId: string
  /** Visitas que suman puntos por día y por socio (las demás se registran sin puntos). */
  maxVisitsPerDay: number
  /** Tope de puntos que puede dar una sola visita. */
  maxPointsPerVisit: number
  /** Plantilla con la que se armó (solo lectura; la escribe applyTemplate). */
  template?: string | null
}

export type ProgramInput = Omit<Program, 'businessId'>

function toProgram(row: Row<'programs'>): Program {
  return {
    businessId: row.business_id,
    enabled: row.enabled,
    kind: row.kind as ProgramKind,
    pointsPerVisit: row.points_per_visit,
    pointsPerAmount: row.points_per_amount,
    amountStepMinor: row.amount_step_minor === null ? null : Number(row.amount_step_minor),
    minAmountMinor: Number(row.min_amount_minor),
    maxVisitsPerDay: row.max_visits_per_day,
    maxPointsPerVisit: row.max_points_per_visit,
    template: row.template,
  }
}

export async function getProgram(businessId: string): Promise<Program | null> {
  const { data, error } = await db()
    .from('programs')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw fromPostgrestError(error)
  return data ? toProgram(data) : null
}

/**
 * Crea o actualiza el programa. Solo dueño/admin (lo exige la base).
 * No usa upsert: el upsert de PostgREST también "actualiza" business_id, y esa
 * columna no se puede modificar (permiso por columna).
 */
export async function saveProgram(businessId: string, input: ProgramInput): Promise<Program> {
  const values = {
    enabled: input.enabled,
    kind: input.kind,
    points_per_visit: input.pointsPerVisit,
    points_per_amount: input.pointsPerAmount,
    amount_step_minor: input.pointsPerAmount > 0 ? input.amountStepMinor : null,
    min_amount_minor: input.minAmountMinor,
    max_visits_per_day: input.maxVisitsPerDay,
    max_points_per_visit: input.maxPointsPerVisit,
  }
  const updated = await db()
    .from('programs')
    .update(values)
    .eq('business_id', businessId)
    .select('*')
    .maybeSingle()
  if (updated.error) throw fromPostgrestError(updated.error)
  if (updated.data) return toProgram(updated.data)

  const { data, error } = await db()
    .from('programs')
    .insert({ business_id: businessId, ...values })
    .select('*')
    .single()
  if (error) throw fromPostgrestError(error)
  return toProgram(data)
}

// Recompensas ---------------------------------------------------------------------

export interface Reward {
  id: string
  name: string
  description: string | null
  costPoints: number
  active: boolean
  availableUntil: string | null
}

export interface RewardInput {
  name: string
  description: string | null
  costPoints: number
  active: boolean
}

function toReward(row: Row<'rewards'>): Reward {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    costPoints: row.cost_points,
    active: row.active,
    availableUntil: row.available_until,
  }
}

export async function listRewards(businessId: string): Promise<Reward[]> {
  const { data, error } = await db()
    .from('rewards')
    .select('*')
    .eq('business_id', businessId)
    .order('active', { ascending: false })
    .order('cost_points')
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map(toReward)
}

export async function createReward(businessId: string, input: RewardInput): Promise<Reward> {
  const { data, error } = await db()
    .from('rewards')
    .insert({
      business_id: businessId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      cost_points: input.costPoints,
      active: input.active,
    })
    .select('*')
    .single()
  if (error) throw fromPostgrestError(error)
  return toReward(data)
}

export async function setRewardActive(rewardId: string, active: boolean): Promise<void> {
  const { error } = await db().from('rewards').update({ active }).eq('id', rewardId)
  if (error) throw fromPostgrestError(error)
}

/** Recompensas que se pueden canjear ahora (activas y no vencidas). */
export function isRewardAvailable(reward: Reward, now = new Date()): boolean {
  return (
    reward.active && (!reward.availableUntil || Date.parse(reward.availableUntil) > now.getTime())
  )
}

// Socios --------------------------------------------------------------------------

export interface Member {
  id: string
  customerId: string
  status: 'active' | 'left'
  pointsBalance: number
  lifetimePoints: number
  joinedAt: string
  /** Código de 8 caracteres para encontrarlo en el mostrador (va en el QR). */
  memberCode: string
  /** Cuándo se generó el último link de su tarjeta digital. */
  cardIssuedAt: string | null
}

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status as Member['status'],
    pointsBalance: Number(row.points_balance),
    lifetimePoints: Number(row.lifetime_points),
    joinedAt: row.joined_at,
    memberCode: row.member_code,
    cardIssuedAt: row.card_issued_at,
  }
}

type MemberRow = Row<'members'>

export async function getMemberByCustomer(customerId: string): Promise<Member | null> {
  const { data, error } = await db()
    .from('members')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle()
  if (error) throw fromPostgrestError(error)
  return data ? toMember(data) : null
}

export async function enroll(customerId: string): Promise<Member> {
  const { data, error } = await db().rpc('enroll_customer', { p_customer_id: customerId })
  if (error) throw fromPostgrestError(error)
  return toMember(data as MemberRow)
}

export async function leave(memberId: string): Promise<Member> {
  const { data, error } = await db().rpc('leave_program', { p_member_id: memberId })
  if (error) throw fromPostgrestError(error)
  return toMember(data as MemberRow)
}

/** Genera un link nuevo para la tarjeta digital (el anterior deja de funcionar). */
export async function issueCard(memberId: string): Promise<string> {
  const { data, error } = await db().rpc('issue_card', { p_member_id: memberId })
  if (error) throw fromPostgrestError(error)
  return data as string
}

/** Busca el cliente por código de socio (QR o escrito). Null si no existe. */
export async function findCustomerByMemberCode(
  businessId: string,
  code: string,
): Promise<string | null> {
  const { data, error } = await db().rpc('find_member_by_code', {
    p_business_id: businessId,
    p_code: code,
  })
  if (error) throw fromPostgrestError(error)
  return (data as string | null) ?? null
}

/** Un código de socio tiene 8 letras/números (sin 0, O, 1 ni I). */
export function looksLikeMemberCode(text: string): boolean {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(text.trim().toUpperCase())
}

/** Ajuste manual (positivo o negativo) con motivo. Solo dueño/admin. */
export async function adjustPoints(memberId: string, delta: number, note: string): Promise<Member> {
  const { data, error } = await db().rpc('adjust_points', {
    p_member_id: memberId,
    p_delta: delta,
    p_note: note,
  })
  if (error) throw fromPostgrestError(error)
  return toMember(data as MemberRow)
}

// Movimientos y canjes ------------------------------------------------------------

export type MovementReason =
  | 'visit'
  | 'visit_voided'
  | 'redemption'
  | 'redemption_cancelled'
  | 'adjustment'

export interface Movement {
  id: number
  delta: number
  reason: MovementReason
  note: string | null
  createdAt: string
}

export async function listMovements(memberId: string, limit = 20): Promise<Movement[]> {
  const { data, error } = await db()
    .from('ledger')
    .select('id, delta, reason, note, created_at')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    delta: Number(row.delta),
    reason: row.reason as MovementReason,
    note: row.note,
    createdAt: row.created_at,
  }))
}

export interface Redemption {
  id: string
  rewardName: string
  points: number
  code: string
  status: 'confirmed' | 'cancelled'
  createdAt: string
}

function toRedemption(row: Row<'redemptions'>): Redemption {
  return {
    id: row.id,
    rewardName: row.reward_name,
    points: row.points,
    code: row.code,
    status: row.status as Redemption['status'],
    createdAt: row.created_at,
  }
}

export async function listRedemptions(memberId: string, limit = 10): Promise<Redemption[]> {
  const { data, error } = await db()
    .from('redemptions')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map(toRedemption)
}

/**
 * Canjea una recompensa. `requestId` tiene que ser el mismo si se reintenta
 * (doble toque, red lenta): la base devuelve el mismo canje sin cobrar dos veces.
 */
export async function redeem(
  memberId: string,
  rewardId: string,
  requestId: string,
): Promise<Redemption> {
  const { data, error } = await db().rpc('redeem_reward', {
    p_member_id: memberId,
    p_reward_id: rewardId,
    p_request_id: requestId,
  })
  if (error) throw fromPostgrestError(error)
  return toRedemption(data as Row<'redemptions'>)
}

/** Cancela un canje y devuelve los puntos. Solo dueño/admin, con motivo. */
export async function cancelRedemption(redemptionId: string, reason: string): Promise<void> {
  const { error } = await db().rpc('cancel_redemption', {
    p_redemption_id: redemptionId,
    p_reason: reason,
  })
  if (error) throw fromPostgrestError(error)
}

/** Texto para mostrar la regla del programa (solo presentación; el cálculo lo hace la base). */
export function describeProgram(
  program: ProgramRule,
  formatAmount: (minor: number) => string,
): string {
  const unit = program.kind === 'stamps' ? 'sello' : 'punto'
  const plural = (n: number) => `${n} ${unit}${n === 1 ? '' : 's'}`
  const parts: string[] = []
  if (program.pointsPerVisit > 0) parts.push(`${plural(program.pointsPerVisit)} por visita`)
  if (program.pointsPerAmount > 0 && program.amountStepMinor) {
    parts.push(`${plural(program.pointsPerAmount)} cada ${formatAmount(program.amountStepMinor)}`)
  }
  let text = parts.join(' + ')
  if (program.minAmountMinor > 0 && program.pointsPerAmount > 0) {
    text += ` (compras desde ${formatAmount(program.minAmountMinor)})`
  }
  return text
}

// Plantillas por rubro (D-032) -----------------------------------------------------------

export interface ProgramTemplate {
  kind: string
  label: string
  /** Titular sugerido para el cartel, ej. "Sumate al club: tu 9.º café es gratis". */
  headline: string
  summary: string
}

export async function listTemplates(): Promise<ProgramTemplate[]> {
  const { data, error } = await db().rpc('list_templates')
  if (error) throw fromPostgrestError(error)
  return ((data ?? []) as unknown as ProgramTemplate[]).map((t) => ({
    kind: t.kind,
    label: t.label,
    headline: t.headline,
    summary: t.summary,
  }))
}

/** Arma el programa y 2 recompensas. Si ya hay movimientos, pide overwrite. */
export async function applyTemplate(
  businessId: string,
  kind: string,
  overwrite = false,
): Promise<void> {
  const { error } = await db().rpc('apply_template', {
    p_business_id: businessId,
    p_kind: kind,
    p_overwrite: overwrite,
  })
  if (error) throw fromPostgrestError(error)
}
