import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { campaigns, errorMessage, type Coupon, type CouponStatus } from '@plataforma/sdk'
import { Alert, Button, Card, Spinner, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { formatDateTime } from '../../lib/format'
import type { CounterPanelProps } from '../types'
import { useCouponLookup, useInvalidateCampaigns } from './queries'

/**
 * Mostrador: el cliente muestra el cupón de una campaña. Se valida y, en una
 * sola llamada a la base, se registra la visita (con el monto escrito arriba, o
 * se reusa la que se cargó hace un momento) y el cupón queda usado (D-026).
 */
export function CouponCounterPanel({
  amountMinor,
  amountInvalid,
  onVisitRecorded,
}: CounterPanelProps) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')

  if (!open) {
    return (
      <Button variant="ghost" fullWidth onClick={() => setOpen(true)}>
        ¿Trae un cupón de una campaña?
      </Button>
    )
  }

  function close() {
    setCode('')
    setOpen(false)
  }

  return (
    <Card className="flex flex-col gap-3">
      <TextField
        label="Código del cupón"
        autoFocus
        autoComplete="off"
        placeholder="K7P2QX"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <CouponResult
        code={code}
        amountMinor={amountMinor}
        amountInvalid={amountInvalid}
        onUsed={() => {
          close()
          onVisitRecorded()
        }}
      />
      <Button variant="secondary" onClick={close}>
        Cancelar
      </Button>
    </Card>
  )
}

interface CouponResultProps {
  code: string
  amountMinor: number | null
  amountInvalid: boolean
  onUsed: () => void
}

function CouponResult({ code, amountMinor, amountInvalid, onUsed }: CouponResultProps) {
  const lookup = useCouponLookup(code)

  if (!campaigns.looksLikeCouponCode(code)) {
    return <p className="text-sm text-slate-500">Son 6 letras y números, como K7P2QX.</p>
  }
  if (lookup.isPending) return <Spinner />
  if (lookup.isError) return <Alert tone="error">{errorMessage(lookup.error)}</Alert>
  if (!lookup.data) return <Alert tone="error">No existe ese cupón. Revisá las letras.</Alert>

  return (
    <CouponDetails
      coupon={lookup.data}
      amountMinor={amountMinor}
      amountInvalid={amountInvalid}
      onUsed={onUsed}
    />
  )
}

const STATUS_TEXT: Record<Exclude<CouponStatus, 'valid'>, string> = {
  used: 'Este cupón ya se usó.',
  expired: 'Este cupón está vencido.',
  customer_inactive: 'Este cliente está archivado: primero reactivalo.',
}

function CouponDetails({
  coupon,
  amountMinor,
  amountInvalid,
  onUsed,
}: Omit<CouponResultProps, 'code'> & { coupon: Coupon }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidateCampaigns = useInvalidateCampaigns(business.id)

  const use = useMutation({
    mutationFn: () =>
      campaigns.recordVisitWithCoupon({
        businessId: business.id,
        code: coupon.code,
        amountMinor,
      }),
    onSuccess: async (result) => {
      const benefit = result.benefit ? ` · ${result.benefit}` : ''
      const reused = result.visitReused
        ? ' (la visita ya estaba cargada: el monto no se cambió)'
        : ''
      toast.show(`Cupón usado: ${result.customerName}${benefit}${reused}`, 'success')
      onUsed()
      await invalidateCampaigns()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3">
      <div>
        <p className="font-medium">{coupon.customerName}</p>
        <p className="text-sm text-slate-600">
          {coupon.benefit ?? 'Sin beneficio cargado'} · campaña "{coupon.campaignName}"
        </p>
        <p className="text-xs text-slate-500">
          {coupon.status === 'used' && coupon.redeemedAt
            ? `Usado el ${formatDateTime(coupon.redeemedAt, business.timezone)}`
            : `Vence el ${formatDateTime(coupon.expiresAt, business.timezone)}`}
        </p>
      </div>
      {coupon.status === 'valid' ? (
        <Button
          size="lg"
          loading={use.isPending}
          disabled={amountInvalid}
          onClick={() => use.mutate()}
        >
          Usar cupón y registrar visita
        </Button>
      ) : (
        <Alert tone="error">{STATUS_TEXT[coupon.status]}</Alert>
      )}
    </div>
  )
}
