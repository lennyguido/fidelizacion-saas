// Alta del cliente por QR (D-032). El cliente se anota solo desde el cartel del
// mostrador; el negocio prende el alta, imprime el cartel y ve los avisos.
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

export interface SelfSignupSettings {
  enabled: boolean
  /** Código público del cartel (10 caracteres). */
  code: string
}

export type SelfSignupStatus =
  | 'created'
  | 'existing'
  | 'unavailable'
  | 'rate_limited'
  | 'terms_required'
  | 'invalid_name'
  | 'invalid_phone'

export interface SelfSignupResult {
  status: SelfSignupStatus
  /** Solo si se creó: link secreto de la tarjeta (D-020). */
  token: string | null
}

export interface SelfSignupInput {
  name: string
  /** Celular en formato E.164 (usar normalizePhone). */
  phone: string
  termsAccepted: boolean
  whatsapp: boolean
}

/** Ruta pública del alta en la app del cliente. */
export function signupPath(code: string): string {
  return `/alta/${encodeURIComponent(code)}`
}

/** Código del cartel a partir de la ruta (/alta/<codigo>), o null. */
export function codeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/alta\/([A-Za-z0-9]{10})\/?$/)
  return match?.[1]?.toUpperCase() ?? null
}

/** Lo llama la persona sin cuenta desde el cartel (función pública, sin sesión). */
export async function signUp(code: string, input: SelfSignupInput): Promise<SelfSignupResult> {
  const { data, error } = await getSupabase().schema('loyalty').rpc('self_signup', {
    p_code: code,
    p_name: input.name,
    p_phone: input.phone,
    p_terms_accepted: input.termsAccepted,
    p_whatsapp: input.whatsapp,
  })
  if (error) throw fromPostgrestError(error)
  const result = (data ?? {}) as { status?: SelfSignupStatus; token?: string }
  return { status: result.status ?? 'unavailable', token: result.token ?? null }
}

// Panel ---------------------------------------------------------------------------------

export async function getSettings(businessId: string): Promise<SelfSignupSettings | null> {
  const { data, error } = await getSupabase()
    .from('self_signup_settings')
    .select('enabled, code')
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw fromPostgrestError(error)
  return data ? { enabled: data.enabled, code: data.code } : null
}

export async function setEnabled(businessId: string, enabled: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('set_self_signup', {
    p_business_id: businessId,
    p_enabled: enabled,
  })
  if (error) throw fromPostgrestError(error)
}

/** Código nuevo: el cartel viejo deja de funcionar. */
export async function rotateCode(businessId: string): Promise<void> {
  const { error } = await getSupabase().rpc('rotate_self_signup_code', {
    p_business_id: businessId,
  })
  if (error) throw fromPostgrestError(error)
}

/** Alguien que ya era cliente se quiso anotar otra vez: hay que reenviarle la tarjeta. */
export interface SelfSignupNotice {
  id: string
  customerId: string
  customerName: string
  nameGiven: string
  createdAt: string
}

export async function listPendingNotices(businessId: string): Promise<SelfSignupNotice[]> {
  const { data, error } = await getSupabase()
    .from('self_signups')
    .select('id, customer_id, name_given, created_at, customer:customers(name)')
    .eq('business_id', businessId)
    .eq('outcome', 'existing')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: customer?.name ?? row.name_given,
      nameGiven: row.name_given,
      createdAt: row.created_at,
    }
  })
}

export async function resolveNotice(noticeId: string): Promise<void> {
  const { error } = await getSupabase().rpc('resolve_self_signup_notice', {
    p_notice_id: noticeId,
  })
  if (error) throw fromPostgrestError(error)
}
