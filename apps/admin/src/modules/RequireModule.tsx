import type { ReactNode } from 'react'
import { EmptyState } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'

/** Protege una ruta de módulo: si el negocio no lo tiene habilitado, no se muestra. */
export function RequireModule({ id, children }: { id: string; children: ReactNode }) {
  const { modules } = useActiveBusiness()
  if (!modules.includes(id)) {
    return (
      <EmptyState
        title="Este módulo no está habilitado"
        description="Tu plan actual no incluye esta función."
      />
    )
  }
  return children
}
