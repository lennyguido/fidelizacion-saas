import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, loyalty, type LoyaltyReward } from '@plataforma/sdk'
import { Alert, Button, Card, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useInvalidateLoyalty } from './queries'

export function RewardsCard({ rewards }: { rewards: LoyaltyReward[] }) {
  const { business } = useActiveBusiness()
  const canManage = business.role !== 'staff'

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Recompensas</h2>
      {rewards.length === 0 && (
        <p className="text-sm text-slate-600">
          Todavía no hay recompensas. Ejemplo: "Café gratis" por 10 puntos.
        </p>
      )}
      {rewards.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {rewards.map((reward) => (
            <RewardRow key={reward.id} reward={reward} canManage={canManage} />
          ))}
        </ul>
      )}
      {canManage && <NewRewardForm />}
    </Card>
  )
}

function RewardRow({ reward, canManage }: { reward: LoyaltyReward; canManage: boolean }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const toggle = useMutation({
    mutationFn: () => loyalty.setRewardActive(reward.id, !reward.active),
    onSuccess: invalidate,
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className={reward.active ? 'font-medium' : 'font-medium text-slate-400 line-through'}>
          {reward.name}
        </p>
        <p className="text-sm text-slate-500">
          {reward.costPoints} puntos{reward.description ? ` · ${reward.description}` : ''}
        </p>
      </div>
      {canManage && (
        <Button variant="ghost" loading={toggle.isPending} onClick={() => toggle.mutate()}>
          {reward.active ? 'Desactivar' : 'Activar'}
        </Button>
      )}
    </li>
  )
}

function NewRewardForm() {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () =>
      loyalty.createReward(business.id, {
        name,
        description: null,
        costPoints: Number(cost),
        active: true,
      }),
    onSuccess: async () => {
      await invalidate()
      setName('')
      setCost('')
      toast.show('Recompensa creada', 'success')
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const costPoints = Number(cost)
    if (!name.trim()) return setError('Poné un nombre.')
    if (!Number.isInteger(costPoints) || costPoints < 1) {
      return setError('El costo tiene que ser un número entero de puntos.')
    }
    create.mutate()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-t border-slate-100 pt-3"
      noValidate
    >
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <TextField
          label="Nueva recompensa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Cuesta (puntos)"
          inputMode="numeric"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </div>
      <div>
        <Button type="submit" variant="secondary" loading={create.isPending}>
          Agregar recompensa
        </Button>
      </div>
    </form>
  )
}
