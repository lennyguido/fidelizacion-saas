import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { moduleManifests } from './registry'
import type { CustomerPanelProps } from './types'

/** Tarjetas que los módulos habilitados agregan en la ficha del cliente. */
export function CustomerModulePanels(props: CustomerPanelProps) {
  const { modules } = useActiveBusiness()
  return (
    <>
      {moduleManifests.map((manifest) => {
        const Panel = manifest.customerPanel
        if (!Panel || !modules.includes(manifest.id)) return null
        return <Panel key={manifest.id} {...props} />
      })}
    </>
  )
}
