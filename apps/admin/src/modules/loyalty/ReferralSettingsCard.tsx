import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, referrals, type ReferralSettings } from '@plataforma/sdk'
import { Button, Card, Spinner, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useInvalidateLoyalty, useReferralRanking, useReferralSettings } from './queries'

/** "Traé un amigo": configuración y ranking (D-036). Solo dueño/admin. */
export function ReferralSettingsCard({ unit }: { unit: string }) {
  const { business } = useActiveBusiness()
  const settings = useReferralSettings(business.id)

  if (settings.isPending) return <Spinner />
  if (!settings.data) return null // todavía no hay programa
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Traé un amigo</h2>
        <p className="text-sm text-slate-600">
          Cada socio tiene un código para invitar. Cuando el amigo viene por primera vez, los dos
          reciben su premio (una sola vez). En la ficha del cliente nuevo cargás quién lo invitó.
        </p>
      </div>
      <ReferralForm key={JSON.stringify(settings.data)} initial={settings.data} unit={unit} />
      {settings.data.enabled && <Ranking />}
    </Card>
  )
}

function ReferralForm({ initial, unit }: { initial: ReferralSettings; unit: string }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [referrer, setReferrer] = useState(String(initial.referrerPoints))
  const [friend, setFriend] = useState(String(initial.friendPoints))

  const toNumber = (value: string) => Number.parseInt(value, 10)
  const valid = (value: string) =>
    /^\d+$/.test(value) && toNumber(value) <= referrals.REFERRAL_POINTS_MAX
  const canSave = valid(referrer) && valid(friend)

  const save = useMutation({
    mutationFn: () =>
      referrals.saveSettings(business.id, {
        enabled,
        referrerPoints: toNumber(referrer),
        friendPoints: toNumber(friend),
      }),
    onSuccess: async () => {
      await invalidate()
      toast.show(enabled ? '"Traé un amigo" está prendido' : 'Guardado', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canSave) save.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Prender "Traé un amigo"
      </label>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          label={`${unit} para quien invita`}
          inputMode="numeric"
          value={referrer}
          onChange={(e) => setReferrer(e.target.value)}
          error={valid(referrer) ? null : 'Un número entre 0 y 10.000'}
        />
        <TextField
          label={`${unit} extra para el amigo`}
          inputMode="numeric"
          value={friend}
          onChange={(e) => setFriend(e.target.value)}
          error={valid(friend) ? null : 'Un número entre 0 y 10.000'}
        />
      </div>
      <div>
        <Button type="submit" loading={save.isPending} disabled={!canSave}>
          Guardar
        </Button>
      </div>
    </form>
  )
}

function Ranking() {
  const { business } = useActiveBusiness()
  const ranking = useReferralRanking(business.id)
  if (ranking.isPending) return <Spinner />
  if (ranking.isError) return null
  if (ranking.data.length === 0) {
    return <p className="text-sm text-slate-500">Todavía nadie invitó a un amigo.</p>
  }
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700">Quién trae más gente</h3>
      <ol className="flex flex-col gap-1 text-sm">
        {ranking.data.map((row, index) => (
          <li key={row.memberId} className="flex justify-between gap-3">
            <span>
              {index + 1}. {row.name}
            </span>
            <span className="text-slate-500">
              {row.rewarded} vinieron{row.pending > 0 && ` · ${row.pending} por venir`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
