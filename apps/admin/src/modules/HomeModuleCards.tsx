import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { moduleManifests } from './registry'

/** Tarjetas que los módulos habilitados agregan en Inicio (solo dueño o admin). */
export function HomeModuleCards() {
  const { business, modules } = useActiveBusiness()
  if (business.role === 'staff') return null
  return (
    <>
      {moduleManifests.map((manifest) => {
        const HomeCard = manifest.homeCard
        if (!HomeCard || !modules.includes(manifest.id)) return null
        return <HomeCard key={manifest.id} />
      })}
    </>
  )
}
