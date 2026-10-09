import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import {
  errorMessage,
  loyalty,
  type LoyaltyMember,
  type LoyaltyMovementReason,
  type LoyaltyRedemption,
  type LoyaltyReward,
} from '@plataforma/sdk'
import { Alert, Button, Card, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { formatDateTime } from '../../lib/format'
import type { CustomerPanelProps } from '../types'
import {
  useInvalidateLoyalty,
  useMember,
  useMovements,
  useProgram,
  useRedemptions,
  useRewards,
} from './queries'

/** Tarjeta de puntos en la ficha del cliente. */
export function CustomerLoyaltyPanel({ customerId, archived }: CustomerPanelProps) {
  const { business } = useActiveBusiness()
  const program = useProgram(business.id)
  const member = useMember(business.id, customerId)

  if (program.isPending || member.isPending) return null
  if (program.error || member.error) {
    return <Alert tone="error">{errorMessage(program.error ?? member.error)}</Alert>
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Puntos</h2>
      {!program.data ? (
        <p className="text-sm text-slate-600">
          Todavía no hay programa de puntos.{' '}
          <Link to={`/b/${business.slug}/fidelizacion`} className="underline">
            Configuralo acá
          </Link>
          .
        </p>
      ) : !member.data || member.data.status === 'left' ? (
        <JoinProgram customerId={customerId} disabled={archived} rejoining={Boolean(member.data)} />
      ) : (
        <MemberView member={member.data} />
      )}
    </Card>
  )
}

function JoinProgram({
  customerId,
  disabled,
  rejoining,
}: {
  customerId: string
  disabled: boolean
  rejoining: boolean
}) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const join = useMutation({
    mutationFn: () => loyalty.enroll(customerId),
    onSuccess: async () => {
      await invalidate()
      toast.show('Se sumó al programa de puntos', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-600">
        {rejoining
          ? 'Salió del programa. Si vuelve, conserva sus puntos.'
          : 'No está en el programa. Sumarse es opcional: sus visitas se cuentan igual.'}
      </p>
      <div>
        <Button loading={join.isPending} disabled={disabled} onClick={() => join.mutate()}>
          Sumar al programa
        </Button>
      </div>
    </div>
  )
}

function MemberView({ member }: { member: LoyaltyMember }) {
  const { business } = useActiveBusiness()
  const canManage = business.role !== 'staff'
  const [lastCode, setLastCode] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <p>
        <span className="text-3xl font-bold" data-testid="points-balance">
          {member.pointsBalance}
        </span>{' '}
        <span className="text-slate-600">puntos</span>
        <span className="ml-2 text-sm text-slate-400">({member.lifetimePoints} en total)</span>
      </p>
      {lastCode && (
        <Alert tone="success">
          Canje confirmado. Código del comprobante: <strong>{lastCode}</strong>
        </Alert>
      )}
      <RedeemList member={member} onRedeemed={setLastCode} />
      <RecentActivity member={member} canManage={canManage} />
      {canManage && <AdjustPointsForm member={member} />}
      <LeaveProgram member={member} />
    </div>
  )
}

function RedeemList({
  member,
  onRedeemed,
}: {
  member: LoyaltyMember
  onRedeemed: (code: string) => void
}) {
  const { business } = useActiveBusiness()
  const rewards = useRewards(business.id)
  const available = (rewards.data ?? []).filter((reward) => loyalty.isRewardAvailable(reward))
  if (available.length === 0) return null
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700">Canjear</h3>
      <ul className="flex flex-col gap-2">
        {available.map((reward) => (
          <RedeemButton key={reward.id} member={member} reward={reward} onRedeemed={onRedeemed} />
        ))}
      </ul>
    </div>
  )
}

function RedeemButton({
  member,
  reward,
  onRedeemed,
}: {
  member: LoyaltyMember
  reward: LoyaltyReward
  onRedeemed: (code: string) => void
}) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  // El mismo id si se reintenta: la base no cobra dos veces (D-018).
  const requestId = useRef<string | null>(null)
  const redeem = useMutation({
    mutationFn: () => {
      requestId.current ??= crypto.randomUUID()
      return loyalty.redeem(member.id, reward.id, requestId.current)
    },
    onSuccess: async (redemption) => {
      requestId.current = null
      await invalidate()
      onRedeemed(redemption.code)
      toast.show(`Canjeó: ${reward.name}`, 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const missing = reward.costPoints - member.pointsBalance

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <div>
        <p className="font-medium">{reward.name}</p>
        <p className="text-sm text-slate-500">
          {reward.costPoints} puntos{missing > 0 ? ` · le faltan ${missing}` : ''}
        </p>
      </div>
      <Button
        variant="secondary"
        loading={redeem.isPending}
        disabled={missing > 0}
        onClick={() => redeem.mutate()}
      >
        Canjear
      </Button>
    </li>
  )
}

const reasonLabels: Record<LoyaltyMovementReason, string> = {
  visit: 'Visita',
  visit_voided: 'Visita anulada',
  redemption: 'Canje',
  redemption_cancelled: 'Canje cancelado',
  adjustment: 'Ajuste',
}

function RecentActivity({ member, canManage }: { member: LoyaltyMember; canManage: boolean }) {
  const { business } = useActiveBusiness()
  const movements = useMovements(business.id, member.id)
  const redemptions = useRedemptions(business.id, member.id)
  const confirmed = (redemptions.data ?? []).filter((r) => r.status === 'confirmed')

  return (
    <div className="flex flex-col gap-3">
      {canManage && confirmed.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Últimos canjes</h3>
          <ul className="flex flex-col gap-2">
            {confirmed.slice(0, 3).map((redemption) => (
              <RedemptionRow key={redemption.id} redemption={redemption} />
            ))}
          </ul>
        </div>
      )}
      {movements.data && movements.data.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Movimientos</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {movements.data.map((movement) => (
              <li key={movement.id} className="flex justify-between gap-3 py-1.5">
                <span className="text-slate-600">
                  {reasonLabels[movement.reason]}
                  {movement.note ? ` · ${movement.note}` : ''}
                  <span className="ml-2 text-slate-400">
                    {formatDateTime(movement.createdAt, business.timezone)}
                  </span>
                </span>
                <span className={movement.delta > 0 ? 'font-medium text-green-700' : 'font-medium'}>
                  {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function RedemptionRow({ redemption }: { redemption: LoyaltyRedemption }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)
  const cancel = useMutation({
    mutationFn: () => loyalty.cancelRedemption(redemption.id, reason),
    onSuccess: async () => {
      await invalidate()
      toast.show('Canje cancelado: se devolvieron los puntos', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <li className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          {redemption.rewardName} · {redemption.code} · {redemption.points} puntos
        </span>
        {!open && (
          <Button variant="ghost" onClick={() => setOpen(true)}>
            Cancelar canje
          </Button>
        )}
      </div>
      {open && (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            cancel.mutate()
          }}
        >
          <TextField label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="danger"
              loading={cancel.isPending}
              disabled={reason.trim().length < 3}
            >
              Cancelar y devolver puntos
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Volver
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}

function AdjustPointsForm({ member }: { member: LoyaltyMember }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const adjust = useMutation({
    mutationFn: () => loyalty.adjustPoints(member.id, Number(delta), note),
    onSuccess: async () => {
      await invalidate()
      setDelta('')
      setNote('')
      toast.show('Puntos ajustados', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const valid = /^-?\d+$/.test(delta.trim()) && Number(delta) !== 0 && note.trim().length >= 3

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (valid) adjust.mutate()
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-slate-600">Ajustar puntos a mano</summary>
      <form
        onSubmit={handleSubmit}
        className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
      >
        <TextField
          label="Puntos (+ o -)"
          inputMode="numeric"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
        />
        <TextField label="Motivo" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" variant="secondary" loading={adjust.isPending} disabled={!valid}>
          Ajustar
        </Button>
      </form>
    </details>
  )
}

function LeaveProgram({ member }: { member: LoyaltyMember }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const leave = useMutation({
    mutationFn: () => loyalty.leave(member.id),
    onSuccess: async () => {
      await invalidate()
      toast.show('Salió del programa (conserva sus puntos)', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  return (
    <div>
      <Button variant="ghost" loading={leave.isPending} onClick={() => leave.mutate()}>
        Sacar del programa
      </Button>
    </div>
  )
}
