// Datos que la base entrega para armar un pase (loyalty.wallet_pass_data).
// Lo mínimo (D-020): nombre de pila, puntos, código de socio y marca del negocio.

export interface PassData {
  passId: string
  provider: 'google' | 'apple'
  /** Google: sufijo del id del objeto. Apple: serialNumber. */
  objectId: string
  businessId: string
  updatedAt: string
  /** false si el socio salió, el cliente se archivó o el módulo está apagado. */
  active: boolean
  business: {
    name: string
    primaryColor: string | null
    logoPath: string | null
  }
  /** null cuando el pase está inactivo. */
  firstName: string | null
  memberCode: string
  pointsBalance: number
  unit: 'puntos' | 'sellos'
  programKind: 'points' | 'stamps'
  /** Costo de la recompensa a la que apunta la tarjeta de sellos (null sin recompensas). */
  stampGoal: number | null
  nextReward: { name: string; costPoints: number } | null
  rewardsAvailable: number
}

/** Normaliza lo que devuelve PostgREST (los bigint pueden llegar como texto). */
export function toPassData(raw: unknown): PassData | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown> & { business?: Record<string, unknown> }
  if (typeof r.passId !== 'string' || typeof r.objectId !== 'string' || !r.business) return null
  const next = r.nextReward as { name?: unknown; costPoints?: unknown } | null | undefined
  return {
    passId: r.passId,
    provider: r.provider === 'apple' ? 'apple' : 'google',
    objectId: r.objectId,
    businessId: String(r.businessId),
    updatedAt: String(r.updatedAt),
    active: r.active === true,
    business: {
      name: String(r.business.name ?? ''),
      primaryColor: typeof r.business.primaryColor === 'string' ? r.business.primaryColor : null,
      logoPath: typeof r.business.logoPath === 'string' ? r.business.logoPath : null,
    },
    firstName: typeof r.firstName === 'string' && r.firstName !== '' ? r.firstName : null,
    memberCode: String(r.memberCode ?? ''),
    pointsBalance: Number(r.pointsBalance ?? 0),
    unit: r.unit === 'sellos' ? 'sellos' : 'puntos',
    programKind: r.programKind === 'stamps' || r.unit === 'sellos' ? 'stamps' : 'points',
    stampGoal:
      r.stampGoal === null || r.stampGoal === undefined || !Number.isFinite(Number(r.stampGoal))
        ? null
        : Number(r.stampGoal),
    nextReward:
      next && typeof next.name === 'string'
        ? { name: next.name, costPoints: Number(next.costPoints) }
        : null,
    rewardsAvailable: Number(r.rewardsAvailable ?? 0),
  }
}
