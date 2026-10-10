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
  }
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
  if (sorted.length === 0) return null
  const points = Math.max(0, Math.trunc(Number.isFinite(balance) ? balance : 0))
  const reward = sorted.find((r) => r.costPoints > points) ?? sorted[0]
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
