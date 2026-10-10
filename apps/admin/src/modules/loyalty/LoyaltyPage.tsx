import { errorMessage } from '@plataforma/sdk'
import { Alert, FullPageSpinner } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { ProgramCard } from './ProgramCard'
import { RewardsCard } from './RewardsCard'
import { SelfSignupCard } from './SelfSignupCard'
import { TemplatesCard } from './TemplatesCard'
import { useProgram, useRewards } from './queries'

export function LoyaltyPage() {
  const { business } = useActiveBusiness()
  const program = useProgram(business.id)
  const rewards = useRewards(business.id)

  if (program.isPending || rewards.isPending) return <FullPageSpinner />
  if (program.isError) return <Alert tone="error">{errorMessage(program.error)}</Alert>
  if (rewards.isError) return <Alert tone="error">{errorMessage(rewards.error)}</Alert>

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fidelización</h1>
        <p className="text-sm text-slate-600">
          Los clientes que se suman al programa juntan puntos con cada visita. Los sumás desde su
          ficha.
        </p>
      </div>
      {business.role !== 'staff' && <TemplatesCard />}
      <ProgramCard program={program.data} />
      <RewardsCard rewards={rewards.data} />
      <SelfSignupCard />
    </section>
  )
}
