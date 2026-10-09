import { createContext, useContext } from 'react'
import type { MyBusiness } from '@plataforma/sdk'

export interface ActiveBusiness {
  business: MyBusiness
  /** Ids de los módulos habilitados hoy (ej. 'loyalty'). */
  modules: string[]
}

export const ActiveBusinessContext = createContext<ActiveBusiness | null>(null)

export function useActiveBusiness(): ActiveBusiness {
  const value = useContext(ActiveBusinessContext)
  if (!value) throw new Error('useActiveBusiness debe usarse dentro de /b/:slug')
  return value
}
