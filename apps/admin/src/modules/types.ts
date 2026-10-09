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
}

export interface CustomerPanelProps {
  customerId: string
  archived: boolean
}
