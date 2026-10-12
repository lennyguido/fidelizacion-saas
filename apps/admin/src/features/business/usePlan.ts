import { useQuery } from '@tanstack/react-query'
import { businesses } from '@plataforma/sdk'
import { useActiveBusiness } from './ActiveBusinessContext'

/** Plan del negocio activo: qué funciones incluye y sus límites (D-044). */
export function usePlan() {
  const { business } = useActiveBusiness()
  return useQuery({
    queryKey: ['customers', business.id, 'plan'],
    queryFn: () => businesses.myPlan(business.id),
  })
}
