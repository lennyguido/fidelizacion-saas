import { createContext, useContext } from 'react'
import type { MyBusiness } from '@plataforma/sdk'

export interface PanelContextValue {
  business: MyBusiness
  businesses: MyBusiness[]
  setBusinessId: (id: string) => void
  email: string
}

export const PanelContext = createContext<PanelContextValue | null>(null)

/** Negocio activo en el panel de Turnos. */
export function usePanel(): PanelContextValue {
  const value = useContext(PanelContext)
  if (!value) throw new Error('usePanel fuera del panel')
  return value
}
