import { useQuery } from '@tanstack/react-query'
import { dashboard, errorMessage, formatMoney } from '@plataforma/sdk'
import { Alert, Card, Spinner } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { formatDateTime } from '../lib/format'

/** Resumen del mes para dueño/admin: comparado con el mismo período del mes pasado. */
export function MonthSummaryCard() {
  const { business } = useActiveBusiness()
  const summary = useQuery({
    queryKey: ['customers', business.id, 'dashboard'],
    queryFn: () => dashboard.summary(business.id),
  })
  const money = (minor: number | null) => formatMoney(minor, business.currency)

  if (summary.isPending) return <Spinner />
  if (summary.isError) return <Alert tone="error">{errorMessage(summary.error)}</Alert>
  const data = summary.data

  const tiles = [
    {
      label: 'Visitas del mes',
      value: String(data.visits),
      change: dashboard.percentChange(data.visits, data.visitsPrev),
    },
    {
      label: 'Ventas registradas',
      value: money(data.revenueMinor),
      change: dashboard.percentChange(data.revenueMinor, data.revenuePrevMinor),
    },
    { label: 'Ticket promedio', value: money(data.avgTicketMinor), change: null },
    { label: 'Clientes nuevos', value: String(data.newCustomers), change: null },
    { label: 'Recuperados', value: String(data.recoveredCustomers), change: null },
    {
      label: 'En juego (en riesgo + inactivos)',
      value: money(data.atRiskValueMinor),
      change: null,
    },
  ]

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Este mes</h2>
        <p className="text-xs text-slate-500">
          Comparado con los mismos días del mes pasado. "En juego" es lo que gastaron en total los
          clientes que dejaron de venir.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs font-medium text-slate-500">{tile.label}</dt>
            <dd className="mt-1 text-xl font-bold">{tile.value}</dd>
            {tile.change !== null && (
              <dd className={`text-xs ${tile.change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {tile.change >= 0 ? '▲' : '▼'} {Math.abs(tile.change)}%
              </dd>
            )}
          </div>
        ))}
      </dl>
      {data.recentVisits.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Últimas visitas</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {data.recentVisits.map((visit, index) => (
              <li
                key={`${visit.occurredAt}-${index}`}
                className="flex justify-between gap-3 py-1.5"
              >
                <span className="truncate">
                  {visit.customerName ?? 'Sin identificar'}
                  <span className="ml-2 text-slate-400">
                    {formatDateTime(visit.occurredAt, business.timezone)}
                  </span>
                </span>
                <span className="text-slate-600">{money(visit.amountMinor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
