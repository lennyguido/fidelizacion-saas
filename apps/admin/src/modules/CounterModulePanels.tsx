import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { moduleManifests } from './registry'
import type { CounterPanelProps } from './types'

/** Tarjetas que los módulos habilitados agregan en el mostrador. */
export function CounterModulePanels(props: CounterPanelProps) {
  const { modules } = useActiveBusiness()
  return (
    <>
      {moduleManifests.map((manifest) => {
        const Panel = manifest.counterPanel
        if (!Panel || !modules.includes(manifest.id)) return null
        return <Panel key={manifest.id} {...props} />
      })}
    </>
  )
}
