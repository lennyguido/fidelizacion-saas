import { useQuery } from '@tanstack/react-query'
import { formatMoney, smartCounter } from '@plataforma/sdk'
import { useActiveBusiness } from '../business/ActiveBusinessContext'

/**
 * Mostrador inteligente (D-038): "hace 2 años · visita 50 · viene cada ~9 días",
 * la nota corta y, para dueño/admin, cuánto gastó (solo con montos cargados).
 */
export function CustomerSnapshot({ customerId }: { customerId: string }) {
  const { business } = useActiveBusiness()
  const snap = useQuery({
    queryKey: ['customers', business.id, 'snapshot', customerId],
    queryFn: () => smartCounter.snapshot(customerId),
    staleTime: 30_000,
  })
  if (!snap.data) return null
  return (
    <div className="text-xs text-slate-600" data-testid="customer-snapshot">
      <p>
        {smartCounter.snapshotLine(snap.data)}
        {snap.data.totalSpendMinor !== null &&
          ` · gastó ${formatMoney(snap.data.totalSpendMinor, business.currency)}`}
      </p>
      {snap.data.note && <p className="truncate italic">“{snap.data.note}”</p>}
    </div>
  )
}
