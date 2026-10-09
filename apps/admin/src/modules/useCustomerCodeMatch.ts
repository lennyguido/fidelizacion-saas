import { useQuery } from '@tanstack/react-query'
import { customers } from '@plataforma/sdk'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { moduleManifests } from './registry'

/** Si lo escrito en el mostrador es un código de algún módulo (ej. socio), busca al cliente. */
export function useCustomerCodeMatch(text: string) {
  const { business, modules } = useActiveBusiness()
  const trimmed = text.trim()
  const lookup = moduleManifests.find(
    (manifest) =>
      manifest.customerCodeLookup &&
      modules.includes(manifest.id) &&
      manifest.customerCodeLookup.matches(trimmed),
  )?.customerCodeLookup

  return useQuery({
    queryKey: ['customers', business.id, 'code', trimmed.toUpperCase()],
    enabled: Boolean(lookup),
    queryFn: async () => {
      if (!lookup) return null
      const customerId = await lookup.find(business.id, trimmed)
      return customerId ? customers.get(customerId) : null
    },
  })
}
