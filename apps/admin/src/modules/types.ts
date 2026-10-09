import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'

export interface ModuleNavItem {
  label: string
  /** Ruta relativa a /b/:slug (ej. 'fidelizacion'). */
  path: string
}

/**
 * Contrato de un módulo en el panel (docs/ARCHITECTURE.md §13.2).
 * El shell monta las rutas y el menú solo si el negocio tiene el módulo habilitado.
 */
export interface ModuleManifest {
  /** Igual al id en core.modules. */
  id: string
  name: string
  nav: ModuleNavItem[]
  routes: RouteObject[]
  /** Tarjeta opcional que el módulo agrega en la ficha del cliente. */
  customerPanel?: ComponentType<CustomerPanelProps>
  /** Permite encontrar un cliente en el mostrador por un código del módulo (ej. QR de socio). */
  customerCodeLookup?: CustomerCodeLookup
  /** Tarjeta opcional que el módulo agrega en el mostrador (ej. usar un cupón). */
  counterPanel?: ComponentType<CounterPanelProps>
}

export interface CounterPanelProps {
  /** Monto escrito en el mostrador (null si no hay o es inválido). */
  amountMinor: number | null
  /** Hay un monto escrito pero no se entiende: no registrar nada. */
  amountInvalid: boolean
  /** Avisa al mostrador que se registró una visita (limpia el formulario y refresca). */
  onVisitRecorded: () => void
}

export interface CustomerPanelProps {
  customerId: string
  customerName: string
  phone: string | null
  archived: boolean
}

export interface CustomerCodeLookup {
  /** ¿El texto escrito tiene forma de código de este módulo? */
  matches: (text: string) => boolean
  /** Devuelve el id del cliente o null. */
  find: (businessId: string, text: string) => Promise<string | null>
}
