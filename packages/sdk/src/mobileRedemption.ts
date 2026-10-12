// Canje desde el celular (D-037). El cliente pide el premio con el link secreto de
// su tarjeta y recibe un código que vence en 5 minutos; el cajero lo confirma y
// recién ahí la base descuenta los puntos (con el canje de siempre).
import { getSupabase } from './client.ts'
import { AppError, fromPostgrestError } from './errors.ts'

function db() {
  return getSupabase().schema('loyalty')
}

export interface RedemptionRequest {
  requestId: string
  code: string
  expiresAt: string
  rewardName: string
  costPoints: number
}

export type RequestStatus = 'pending' | 'confirmed' | 'replaced' | 'expired'

export interface RequestState {
  status: RequestStatus
  expiresAt: string
  /** Código del comprobante, cuando ya se canjeó. */
  redemptionCode: string | null
}

/** Cliente (tarjeta): pedir un premio. No descuenta nada todavía. */
export async function request(token: string, rewardId: string): Promise<RedemptionRequest> {
  const { data, error } = await db().rpc('request_redemption', {
    p_token: token,
    p_reward_id: rewardId,
  })
  if (error) {
    if (error.code === '54000') {
      throw new AppError('rate_limited', 'Demasiados pedidos seguidos. Esperá un rato.')
    }
    throw fromPostgrestError(error)
  }
  const raw = data as unknown as RedemptionRequest
  return { ...raw, costPoints: Number(raw.costPoints) }
}

/** Cliente (tarjeta): ¿ya se canjeó? null si el pedido no es de esta tarjeta. */
export async function getState(token: string, requestId: string): Promise<RequestState | null> {
  const { data, error } = await db().rpc('get_redemption_request', {
    p_token: token,
    p_request_id: requestId,
  })
  if (error) throw fromPostgrestError(error)
  return (data as unknown as RequestState | null) ?? null
}

export interface FoundRequest {
  requestId: string
  expiresAt: string
  customerId: string
  customerName: string
  rewardName: string
  costPoints: number
  pointsBalance: number
  enough: boolean
}

/** Mostrador: buscar el pedido vivo por su código. null si no existe o venció. */
export async function find(businessId: string, code: string): Promise<FoundRequest | null> {
  const { data, error } = await db().rpc('find_redemption_request', {
    p_business_id: businessId,
    p_code: code.trim().toUpperCase(),
  })
  if (error) throw fromPostgrestError(error)
  if (!data) return null
  const raw = data as unknown as FoundRequest
  return { ...raw, costPoints: Number(raw.costPoints), pointsBalance: Number(raw.pointsBalance) }
}

/** Mostrador: confirmar el canje (descuenta). Confirmar dos veces devuelve el mismo canje. */
export async function confirm(requestId: string): Promise<{ code: string }> {
  const { data, error } = await db().rpc('confirm_redemption_request', {
    p_request_id: requestId,
  })
  if (error) throw fromPostgrestError(error)
  return { code: (data as { code: string }).code }
}

/** Mismo formato que los demás códigos cortos: 6 letras y números sin 0/O/1/I. */
export function looksLikeRequestCode(text: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(text.trim().toUpperCase())
}

/** Segundos que faltan para que venza (0 si ya venció). */
export function secondsLeft(expiresAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000))
}
