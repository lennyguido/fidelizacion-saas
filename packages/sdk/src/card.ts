// Tarjeta digital del cliente final (D-020). La lee cualquiera que tenga el link:
// es solo lectura y la arma la base (loyalty.get_card).
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'
import type { MovementReason, Program, ProgramKind } from './loyalty.ts'

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
  }
  firstName: string
  memberCode: string
  pointsBalance: number
  lifetimePoints: number
  program: Program | null
  rewards: CardReward[]
  movements: CardMovement[]
}

interface RawCard {
  business: { name: string; slug: string; currency: string; primaryColor: string | null }
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
    business: raw.business,
    firstName: raw.firstName,
    memberCode: raw.memberCode,
    pointsBalance: Number(raw.pointsBalance),
    lifetimePoints: Number(raw.lifetimePoints),
    program: raw.program
      ? {
          businessId: '',
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
