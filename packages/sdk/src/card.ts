// Tarjeta digital del cliente final (D-020). La lee cualquiera que tenga el link:
// es solo lectura y la arma la base (loyalty.get_card).
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'
import type { MovementReason, ProgramKind, ProgramRule } from './loyalty.ts'

export interface CardReward {
  id: string
  name: string
  description: string | null
  costPoints: number
}

export interface CardMovement {
  delta: number
  reason: MovementReason
  createdAt: string
}

export interface Card {
  business: {
    name: string
    slug: string
    currency: string
    primaryColor: string | null
    /** Ruta del logo en el bucket público; armar el link con businesses.logoUrl(). */
    logoPath: string | null
  }
  firstName: string
  memberCode: string
  pointsBalance: number
  lifetimePoints: number
  program: ProgramRule | null
  rewards: CardReward[]
  movements: CardMovement[]
  /** "Traé un amigo": null si el negocio no lo usa. */
  referral: CardReferral | null
  /** Visita reciente que todavía no tiene opinión (encuesta "¿Cómo te atendimos?"). */
  feedbackVisitId: string | null
  /** Link de reseñas de Google del negocio. */
  reviewUrl: string | null
}

export interface CardReferral {
  code: string
  referrerPoints: number
  friendPoints: number
}

interface RawCard {
  business: {
    name: string
    slug: string
    currency: string
    primaryColor: string | null
    logoPath?: string | null
  }
  firstName: string
  memberCode: string
  pointsBalance: number
  lifetimePoints: number
  program: {
    enabled: boolean
    kind: ProgramKind
    pointsPerVisit: number
    pointsPerAmount: number
    amountStepMinor: number | null
    minAmountMinor: number
  } | null
  rewards: CardReward[]
  movements: CardMovement[]
  // Las tres siguientes llegan con la migración de la encuesta (D-036); antes, no vienen.
  referral?: CardReferral | null
  feedback?: { visitId: string } | null
  reviewUrl?: string | null
}

/** Los links tienen el código después de "#", así no viaja a ningún servidor. */
export function tokenFromHash(hash: string): string | null {
  const value = hash.replace(/^#/, '').replace(/^t=/, '').trim().toLowerCase()
  return /^[0-9a-f]{64}$/.test(value) ? value : null
}

export function cardUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/tarjeta#${token}`
}

/** Devuelve null si el link no existe, se regeneró o el cliente salió del programa. */
export async function getCard(token: string): Promise<Card | null> {
  const { data, error } = await getSupabase().schema('loyalty').rpc('get_card', { p_token: token })
  if (error) throw fromPostgrestError(error)
  if (!data) return null
  const raw = data as unknown as RawCard
  return {
    business: { ...raw.business, logoPath: raw.business.logoPath ?? null },
    firstName: raw.firstName,
    memberCode: raw.memberCode,
    pointsBalance: Number(raw.pointsBalance),
    lifetimePoints: Number(raw.lifetimePoints),
    program: raw.program
      ? {
          ...raw.program,
          amountStepMinor:
            raw.program.amountStepMinor === null ? null : Number(raw.program.amountStepMinor),
          minAmountMinor: Number(raw.program.minAmountMinor),
        }
      : null,
    rewards: raw.rewards,
    movements: raw.movements.map((m) => ({ ...m, delta: Number(m.delta) })),
    referral: raw.referral ?? null,
    feedbackVisitId: raw.feedback?.visitId ?? null,
    reviewUrl: raw.reviewUrl ?? null,
  }
}

/**
 * Opinión del cliente sobre su visita (1 a 5). Devuelve el link de reseñas de
 * Google, que se le ofrece a todos sin importar la nota (Google prohíbe filtrar).
 */
export async function submitFeedback(
  token: string,
  visitId: string,
  rating: number,
  comment: string,
): Promise<{ reviewUrl: string | null }> {
  const { data, error } = await getSupabase()
    .schema('loyalty')
    .rpc('submit_feedback', {
      p_token: token,
      p_visit_id: visitId,
      p_rating: rating,
      ...(comment.trim() ? { p_comment: comment.trim() } : {}),
    })
  if (error) throw fromPostgrestError(error)
  const result = data as { reviewUrl?: string | null } | null
  return { reviewUrl: result?.reviewUrl ?? null }
}

/** Texto para compartir la invitación por WhatsApp. */
export function referralShareText(businessName: string, referral: CardReferral): string {
  const gift =
    referral.friendPoints > 0 ? ` y te regalan ${referral.friendPoints} en tu primera visita` : ''
  return `Te invito a sumarte al club de ${businessName}${gift}. En la caja decí mi código: ${referral.code}`
}

/** La próxima recompensa que todavía no le alcanza (para mostrar el progreso). */
export function nextReward(card: Pick<Card, 'pointsBalance' | 'rewards'>): CardReward | null {
  return card.rewards.find((reward) => reward.costPoints > card.pointsBalance) ?? null
}

/** Máximo de casilleros que se dibujan en la tarjeta de sellos. */
export const MAX_STAMP_SLOTS = 20

export interface StampSlots {
  /** Casilleros que se dibujan (como mucho MAX_STAMP_SLOTS). */
  total: number
  /** Casilleros llenos (0..total). */
  filled: number
  /** Costo real de la recompensa a la que apunta la tarjeta. */
  goal: number
  /** Sellos que ya cuentan para esa recompensa (0..goal). */
  progress: number
  /** Sellos que faltan (0 si ya le alcanza para todas). */
  missing: number
  /** La recompensa a la que apunta: la próxima, o la más barata si ya llegó a todas. */
  reward: CardReward
  /** Recompensas que ya puede canjear (costo ≤ saldo). */
  readyCount: number
}

/**
 * Casilleros de la tarjeta de sellos. Apunta a la próxima recompensa que todavía no
 * le alcanza; si ya le alcanzan todas, a la más barata (y se muestra llena).
 * Con recompensas de más de MAX_STAMP_SLOTS, los casilleros se llenan en proporción.
 * null si no hay recompensas. Misma regla que supabase/functions/wallet/lib/stamps.ts.
 */
export function stampSlots(balance: number, rewards: CardReward[]): StampSlots | null {
  const sorted = rewards
    .filter((r) => Number.isFinite(r.costPoints) && r.costPoints > 0)
    .sort((a, b) => a.costPoints - b.costPoints)
  const cheapest = sorted[0]
  if (!cheapest) return null
  const points = Math.max(0, Math.trunc(Number.isFinite(balance) ? balance : 0))
  const reward = sorted.find((r) => r.costPoints > points) ?? cheapest
  const goal = reward.costPoints
  const progress = Math.min(points, goal)
  const total = Math.min(goal, MAX_STAMP_SLOTS)
  const filled = progress >= goal ? total : Math.floor((progress * total) / goal)
  return {
    total,
    filled,
    goal,
    progress,
    missing: goal - progress,
    reward,
    readyCount: sorted.filter((r) => r.costPoints <= points).length,
  }
}

/**
 * La tarjeta se dibuja con sellos en los programas de sellos y, en los de puntos,
 * cuando la recompensa cuesta pocos puntos (≤ MAX_STAMP_SLOTS).
 */
export function showsStamps(
  kind: ProgramKind | null | undefined,
  slots: StampSlots | null,
): slots is StampSlots {
  if (!slots) return false
  return kind === 'stamps' || slots.goal <= MAX_STAMP_SLOTS
}
