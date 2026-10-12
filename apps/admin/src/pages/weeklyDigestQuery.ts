import { useQuery } from '@tanstack/react-query'
import { weeklyDigest } from '@plataforma/sdk'

export function useWeeklyDigest(businessId: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['customers', businessId, 'weekly-digest'],
    queryFn: () => weeklyDigest.get(businessId),
  })
}

/** Adónde lleva el botón de la acción sugerida (null si no hay a dónde ir). */
export function actionLink(
  base: string,
  action: weeklyDigest.DigestAction,
): { to: string; label: string } | null {
  switch (action.kind) {
    case 'load_visits':
    case 'ask_phone':
      return { to: `${base}/mostrador`, label: 'Ir al mostrador' }
    case 'contact_at_risk':
      return action.customerId
        ? { to: `${base}/clientes/${action.customerId}`, label: 'Ver su ficha' }
        : null
    case 'turn_on_automations':
      return { to: `${base}/recuperacion/automatico`, label: 'Prender la recuperación' }
    case 'review_alerts':
      return { to: `${base}/semana`, label: 'Ver alertas' }
    case 'keep_going':
      return null
  }
}
