import type { CustomerStatus } from '@plataforma/sdk'

export const statusInfo: Record<
  CustomerStatus,
  { label: string; plural: string; badge: string; text: string }
> = {
  NEW: { label: 'Nuevo', plural: 'Nuevos', badge: 'bg-sky-100 text-sky-800', text: 'text-sky-700' },
  ACTIVE: {
    label: 'Activo',
    plural: 'Activos',
    badge: 'bg-emerald-100 text-emerald-800',
    text: 'text-emerald-700',
  },
  AT_RISK: {
    label: 'En riesgo',
    plural: 'En riesgo',
    badge: 'bg-amber-100 text-amber-800',
    text: 'text-amber-700',
  },
  INACTIVE: {
    label: 'Inactivo',
    plural: 'Inactivos',
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-700',
  },
  RECOVERED: {
    label: 'Recuperado',
    plural: 'Recuperados',
    badge: 'bg-violet-100 text-violet-800',
    text: 'text-violet-700',
  },
}
