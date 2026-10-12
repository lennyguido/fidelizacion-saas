// Planes y contacto de venta (docs/marketing/PRECIOS.md, D-043).

export interface Plan {
  id: 'barrio' | 'local' | 'cadena'
  name: string
  price: number
  yearly: number
  tagline: string
  features: string[]
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'barrio',
    name: 'Barrio',
    price: 24900,
    yearly: 249000,
    tagline: 'Para el local que arranca.',
    features: [
      '1 sucursal · 1.000 clientes',
      '2 personas en el mostrador',
      'Tarjeta de sellos en el celular',
      'Lista de clientes dormidos + mensaje armado',
      '"Plata que volvió", medida en serio',
      'Soporte por WhatsApp',
    ],
  },
  {
    id: 'local',
    name: 'Local',
    price: 44900,
    yearly: 449000,
    tagline: 'El que trabaja solo mientras vos atendés.',
    highlight: true,
    features: [
      '1 sucursal · 5.000 clientes',
      '5 personas en el mostrador',
      'Recuperación automática todas las mañanas',
      'Cumpleaños y segunda visita automáticos',
      'Alta por QR + cartel para imprimir',
      'Soporte prioritario',
    ],
  },
  {
    id: 'cadena',
    name: 'Cadena',
    price: 79900,
    yearly: 799000,
    tagline: 'Varios locales, una sola vista.',
    features: [
      'Hasta 5 sucursales · 20.000 clientes',
      'Equipo sin límite',
      'Todo lo del plan Local',
      'Conexión con tu caja',
      'Las ventas entran solas, sin escanear',
      'Cuenta asignada',
    ],
  },
]

/** Número de ventas en formato internacional, solo dígitos (wa.me). */
export const SALES_WHATSAPP =
  (import.meta.env.VITE_SALES_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '5491128330853'

export function formatPesos(value: number): string {
  return `$${Math.round(value).toLocaleString('es-AR')}`
}

/** Link de WhatsApp con el pedido ya escrito. */
export function buyLink(plan: Plan | null): string {
  const text = plan
    ? `¡Hola! Quiero contratar Neriva, plan ${plan.name} (${formatPesos(plan.price)}/mes). Mi negocio es: `
    : '¡Hola! Quiero saber más de Neriva para mi negocio.'
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`
}
