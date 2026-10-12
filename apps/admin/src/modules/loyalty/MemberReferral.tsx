import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, referrals, type LoyaltyMember } from '@plataforma/sdk'
import { Button, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useInvalidateLoyalty, useMemberReferral, useReferralSettings } from './queries'

const statusText = {
  pending: 'el premio llega con su primera visita',
  rewarded: 'premio entregado',
  voided: 'premio anulado',
} as const

/** En la ficha: código para invitar y "¿Lo invitó alguien?" (D-036). */
export function MemberReferral({ member }: { member: LoyaltyMember }) {
  const { business } = useActiveBusiness()
  const settings = useReferralSettings(business.id)
  const referral = useMemberReferral(business.id, member.id)

  if (!settings.data?.enabled || !referral.data) return null
  const { code, invitedBy } = referral.data

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm">
      <p>
        Código para invitar amigos: <strong className="font-mono tracking-wider">{code}</strong>
      </p>
      {invitedBy ? (
        <p className="text-slate-600">
          Lo invitó {invitedBy.name} ({statusText[invitedBy.status]}).
        </p>
      ) : (
        // Solo para clientes nuevos (la base además exige que no tenga visitas).
        member.lifetimePoints === 0 && <SetReferrerForm memberId={member.id} />
      )}
    </div>
  )
}

function SetReferrerForm({ memberId }: { memberId: string }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const [code, setCode] = useState('')
  const save = useMutation({
    mutationFn: () => referrals.setReferrer(memberId, code),
    onSuccess: async () => {
      setCode('')
      await invalidate()
      toast.show('Listo: los dos reciben el premio con su primera visita', 'success')
    },
    onError: (err) =>
      toast.show(referrals.setReferrerErrorMessage(err) ?? errorMessage(err), 'error'),
  })
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim()) save.mutate()
  }
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <TextField
        label="¿Lo invitó alguien? Código"
        value={code}
        maxLength={6}
        autoCapitalize="characters"
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      <Button type="submit" variant="secondary" loading={save.isPending} disabled={!code.trim()}>
        Cargar
      </Button>
    </form>
  )
}
