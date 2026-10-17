/** Datos de contacto y planes de la home. */

/** WhatsApp de ventas, solo dígitos en formato internacional (el mismo de fidelización). */
export const WHATSAPP =
  (import.meta.env.VITE_SALES_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '5491128330853'

export function whatsappLink(text: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`
}

export const STORE_URL = 'https://tienda.neriva.net'

export interface Plan {
  id: string
  name: string
  /** Precio por mes en pesos, o null mientras falte el dato. */
  price: number | null
  includes: string
  note?: string
}

/** Precios para un local (D-058). Solo Fidelización = plan Barrio de fidelizacion.neriva.net. */
export const BUNDLE: Plan = {
  id: 'paquete',
  name: 'Paquete Neriva',
  price: 34900,
  includes: 'Turnos + Fidelización',
  note: 'Te ahorrás $9.900 por mes, y si te quedás 6 meses la web va incluida.',
}

export const SINGLE_PLANS: Plan[] = [
  { id: 'turnos', name: 'Solo Turnos', price: 19900, includes: 'Neriva Turnos' },
  { id: 'fidelizacion', name: 'Solo Fidelización', price: 24900, includes: 'Neriva Fidelización' },
]

export function formatPrice(price: number | null): string {
  return price === null ? '[PRECIO]' : `$${price.toLocaleString('es-AR')}`
}
