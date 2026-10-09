import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, formatMoney, visits, type Visit } from '@plataforma/sdk'
import { Alert, Button, TextField, useToast } from '@plataforma/ui'
import { formatDateTime } from '../../lib/format'

const sourceLabels: Record<string, string> = {
  manual: 'Mostrador',
  qr_customer: 'QR del cliente',
  qr_business: 'QR del local',
  import: 'Importada',
  booking: 'Turno',
  mercadopago: 'Mercado Pago',
  pos: 'Caja',
}

interface Props {
  items: Visit[]
  timeZone: string
  currency: string
  canVoid: boolean
  onChanged: () => Promise<unknown>
}

export function VisitHistory({ items, timeZone, currency, canVoid, onChanged }: Props) {
  if (items.length === 0) return <p className="text-sm text-slate-500">Todavía no tiene visitas.</p>

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((visit) => (
        <VisitRow
          key={visit.id}
          visit={visit}
          timeZone={timeZone}
          currency={currency}
          canVoid={canVoid}
          onChanged={onChanged}
        />
      ))}
    </ul>
  )
}

function VisitRow({
  visit,
  timeZone,
  currency,
  canVoid,
  onChanged,
}: Omit<Props, 'items'> & { visit: Visit }) {
  const toast = useToast()
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const voidMutation = useMutation({
    mutationFn: () => visits.voidVisit(visit.id, reason),
    onSuccess: async () => {
      await onChanged()
      toast.show('Visita anulada', 'success')
      setVoiding(false)
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const voided = visit.voidedAt !== null

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className={voided ? 'text-slate-400 line-through' : ''}>
          <p className="text-sm font-medium">{formatDateTime(visit.occurredAt, timeZone)}</p>
          <p className="text-xs text-slate-500">
            {sourceLabels[visit.source] ?? visit.source}
            {visit.amountMinor !== null && ` · ${formatMoney(visit.amountMinor, currency)}`}
          </p>
        </div>
        {voided ? (
          <span className="text-xs text-slate-500">Anulada: {visit.voidReason}</span>
        ) : (
          canVoid &&
          !voiding && (
            <Button variant="ghost" onClick={() => setVoiding(true)}>
              Anular
            </Button>
          )
        )}
      </div>
      {voiding && (
        <form
          className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            voidMutation.mutate()
          }}
        >
          {error && <Alert tone="error">{error}</Alert>}
          <TextField
            label="Motivo"
            placeholder="Se cargó dos veces"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="danger"
              loading={voidMutation.isPending}
              disabled={reason.trim().length < 3}
            >
              Anular visita
            </Button>
            <Button variant="secondary" onClick={() => setVoiding(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}
