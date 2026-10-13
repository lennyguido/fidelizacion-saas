// Catálogo de planes para mostrar en el panel (docs/marketing/PRECIOS.md, D-044, D-047).
// Lo que manda de verdad es la base (core.plans.features); esto es para ofrecer
// el plan siguiente con su precio y armar el pedido por WhatsApp.

import type { SalesPlan } from './access.ts'
import type { PlanInfo } from './businesses.ts'

export type PlanFeature = 'automations' | 'selfSignup' | 'cashRegister'
export type PlanLimit = 'maxCustomers' | 'maxStaff' | 'maxLocations'

export interface CatalogPlan {
  id: SalesPlan
  name: string
  /** Precio mensual en pesos. */
  price: number
  features: Record<PlanFeature, boolean>
  /** null = sin límite. */
  limits: Record<PlanLimit, number | null>
}

export const PLAN_CATALOG: CatalogPlan[] = [
  {
    id: 'barrio',
    name: 'Barrio',
    price: 24900,
    features: { automations: false, selfSignup: false, cashRegister: false },
    limits: { maxCustomers: 1000, maxStaff: 2, maxLocations: 1 },
  },
  {
    id: 'local',
    name: 'Local',
    price: 44900,
    features: { automations: true, selfSignup: true, cashRegister: false },
    limits: { maxCustomers: 5000, maxStaff: 5, maxLocations: 1 },
  },
  {
    id: 'cadena',
    name: 'Cadena',
    price: 79900,
    features: { automations: true, selfSignup: true, cashRegister: true },
    limits: { maxCustomers: 20000, maxStaff: null, maxLocations: 5 },
  },
]

/** Qué gana el dueño con cada función, en una línea (para el aviso de "pasate a…"). */
export const FEATURE_PITCH: Record<PlanFeature, { title: string; benefit: string }> = {
  automations: {
    title: 'Recuperación automática',
    benefit: 'Todas las mañanas el sistema arma los mensajes para los clientes que dejaron de venir.',
  },
  selfSignup: {
    title: 'Alta por QR',
    benefit: 'Tus clientes se suman solos escaneando un cartel, sin hacer fila en la caja.',
  },
  cashRegister: {
    title: 'Conexión con la caja',
    benefit: 'Cada venta suma la visita sola, sin escanear nada en el mostrador.',
  },
}

export const LIMIT_LABELS: Record<PlanLimit, { one: string; many: string }> = {
  maxCustomers: { one: 'cliente', many: 'clientes' },
  maxStaff: { one: 'persona en el equipo', many: 'personas en el equipo' },
  maxLocations: { one: 'sucursal', many: 'sucursales' },
}

function rank(planId: string): number {
  const index = PLAN_CATALOG.findIndex((plan) => plan.id === planId)
  return index === -1 ? -1 : index
}

/** El plan más barato, por encima del actual, que incluye la función. */
export function planWithFeature(currentPlanId: string, feature: PlanFeature): CatalogPlan | null {
  return (
    PLAN_CATALOG.find((plan) => rank(plan.id) > rank(currentPlanId) && plan.features[feature]) ??
    null
  )
}

/** El plan más barato, por encima del actual, que permite más de `used` en ese límite. */
export function planWithMore(
  currentPlanId: string,
  limit: PlanLimit,
  used: number,
): CatalogPlan | null {
  return (
    PLAN_CATALOG.find((plan) => {
      if (rank(plan.id) <= rank(currentPlanId)) return false
      const max = plan.limits[limit]
      return max === null || max > used
    }) ?? null
  )
}

/** ¿Llegó al tope? (los planes sin límite nunca). */
export function isAtLimit(plan: PlanInfo, limit: PlanLimit, used: number): boolean {
  const max = plan.features[limit]
  return max !== null && used >= max
}

/** ¿Está cerca del tope? (80 % o más, sin haberlo alcanzado). */
export function isNearLimit(plan: PlanInfo, limit: PlanLimit, used: number): boolean {
  const max = plan.features[limit]
  return max !== null && used < max && used >= Math.ceil(max * 0.8)
}

export function formatPesos(value: number): string {
  return `$${Math.round(value).toLocaleString('es-AR')}`
}

/** Número de ventas por defecto (el mismo de neriva.net). */
export const DEFAULT_SALES_WHATSAPP = '5491128330853'

/** Link de WhatsApp con el pedido de cambio de plan ya escrito. */
export function upgradeLink(
  plan: CatalogPlan,
  businessName: string,
  reason: string,
  salesNumber: string = DEFAULT_SALES_WHATSAPP,
): string {
  const text =
    `¡Hola! Quiero pasar ${businessName} al plan ${plan.name} ` +
    `(${formatPesos(plan.price)}/mes). Lo necesito para: ${reason}.`
  return `https://wa.me/${salesNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}
