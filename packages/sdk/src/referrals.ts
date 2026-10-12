// "Traé un amigo" (D-036, módulo Fidelización). La base decide cuándo se premia
// (primera visita real del amigo); acá solo se configura, se carga el código y se lee.
import { getSupabase } from './client.ts'
import { AppError, fromPostgrestError } from './errors.ts'

function db() {
  return getSupabase().schema('loyalty')
}

export interface ReferralSettings {
  enabled: boolean
  /** Puntos o sellos para quien invita. */
  referrerPoints: number
  /** Puntos o sellos extra para el amigo, además de los de su visita. */
  friendPoints: number
}

export const REFERRAL_POINTS_MAX = 10000

export async function getSettings(businessId: string): Promise<ReferralSettings | null> {
  const { data, error } = await db()
    .from('programs')
    .select('referral_enabled, referral_points_referrer, referral_points_friend')
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw fromPostgrestError(error)
  if (!data) return null
  return {
    enabled: data.referral_enabled,
    referrerPoints: data.referral_points_referrer,
    friendPoints: data.referral_points_friend,
  }
}

/** Solo dueño/admin (lo exige la base). Necesita el programa ya creado. */
export async function saveSettings(businessId: string, input: ReferralSettings): Promise<void> {
  const { data, error } = await db()
    .from('programs')
    .update({
      referral_enabled: input.enabled,
      referral_points_referrer: input.referrerPoints,
      referral_points_friend: input.friendPoints,
    })
    .eq('business_id', businessId)
    .select('business_id')
  if (error) throw fromPostgrestError(error)
  if (!data || data.length === 0) {
    throw new AppError('not_found', 'Primero configurá el programa de puntos.')
  }
}

export interface MemberReferral {
  /** Código para que este socio invite a sus amigos. */
  code: string
  /** Quién lo invitó a él (si lo cargaron) y cómo está ese premio. */
  invitedBy: { name: string; status: 'pending' | 'rewarded' | 'voided' } | null
}

export async function getMemberReferral(memberId: string): Promise<MemberReferral> {
  const member = await db().from('members').select('referral_code').eq('id', memberId).single()
  if (member.error) throw fromPostgrestError(member.error)
  const referral = await db()
    .from('referrals')
    .select('status, referrer_member_id')
    .eq('friend_member_id', memberId)
    .maybeSingle()
  if (referral.error) throw fromPostgrestError(referral.error)
  let invitedBy: MemberReferral['invitedBy'] = null
  if (referral.data) {
    const referrer = await db()
      .from('members')
      .select('customer_id')
      .eq('id', referral.data.referrer_member_id)
      .single()
    if (referrer.error) throw fromPostgrestError(referrer.error)
    const customer = await getSupabase()
      .from('customers')
      .select('name')
      .eq('id', referrer.data.customer_id)
      .single()
    if (customer.error) throw fromPostgrestError(customer.error)
    invitedBy = {
      name: customer.data.name,
      status: referral.data.status as 'pending' | 'rewarded' | 'voided',
    }
  }
  return { code: member.data.referral_code, invitedBy }
}

const SET_REFERRER_ERRORS: Record<string, string> = {
  'referrals are off': '"Traé un amigo" está apagado. Prendelo en Fidelización.',
  'referral code not found': 'No hay ningún socio con ese código.',
  'cannot refer yourself': 'Es el código de este mismo cliente.',
  'friend already has visits': 'Solo se puede cargar a clientes nuevos, sin visitas.',
  'member already has a referrer': 'Este cliente ya tiene cargado quién lo invitó.',
  'referral cycle': 'Este cliente invitó a esa persona: no pueden invitarse entre los dos.',
  'member is not active': 'El cliente no está en el programa.',
}

/** Mensaje en castellano para los errores de setReferrer. */
export function setReferrerErrorMessage(error: unknown): string | null {
  const text = error instanceof Error ? error.message : String(error)
  const match = Object.keys(SET_REFERRER_ERRORS).find((key) => text.includes(key))
  return match ? (SET_REFERRER_ERRORS[match] ?? null) : null
}

/** Cargar quién invitó a un socio nuevo (cualquier miembro del equipo). */
export async function setReferrer(friendMemberId: string, code: string): Promise<void> {
  const { error } = await db().rpc('set_referrer', {
    p_friend_member_id: friendMemberId,
    p_code: code.trim().toUpperCase(),
  })
  if (error) throw fromPostgrestError(error)
}

export interface RankingRow {
  memberId: string
  name: string
  /** Amigos que ya vinieron (premio entregado). */
  rewarded: number
  /** Amigos anotados que todavía no vinieron. */
  pending: number
}

/** "Quién trae más gente" (dueño/admin). */
export async function ranking(businessId: string): Promise<RankingRow[]> {
  const { data, error } = await db().rpc('referral_ranking', { p_business_id: businessId })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    memberId: row.member_id,
    name: row.name,
    rewarded: row.rewarded,
    pending: row.pending,
  }))
}
