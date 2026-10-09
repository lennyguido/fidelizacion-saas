import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { moduleManifests } from './registry'

/** Tarjetas que los módulos habilitados agregan en la ficha del cliente. */
export function CustomerModulePanels({
  customerId,
  archived,
}: {
  customerId: string
  archived: boolean
}) {
  const { modules } = useActiveBusiness()
  return (
    <>
      {moduleManifests.map((manifest) => {
        const Panel = manifest.customerPanel
        if (!Panel || !modules.includes(manifest.id)) return null
        return <Panel key={manifest.id} customerId={customerId} archived={archived} />
      })}
    </>
  )
}
