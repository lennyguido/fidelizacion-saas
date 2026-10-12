import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { formatMoney, smartCounter } from '@plataforma/sdk'
import { Card } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { formatDaysAgo } from '../lib/format'

/** Top 10: los que más vinieron en los últimos 90 días (D-038). Solo dueño/admin. */
export function TopCustomersCard() {
  const { business } = useActiveBusiness()
  const top = useQuery({
    queryKey: ['customers', business.id, 'top'],
    queryFn: () => smartCounter.topCustomers(business.id),
  })
  if (!top.data || top.data.length === 0) return null

  return (
    <Card className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-semibold">Tus mejores clientes</h2>
        <p className="text-xs text-slate-500">Los que más vinieron en los últimos 90 días.</p>
      </div>
      <ol className="divide-y divide-slate-100 text-sm">
        {top.data.map((customer, index) => (
          <li key={customer.customerId} className="flex justify-between gap-3 py-1.5">
            <Link
              to={`/b/${business.slug}/clientes/${customer.customerId}`}
              className="truncate underline"
            >
              {index + 1}. {customer.name}
            </Link>
            <span className="shrink-0 text-slate-500">
              {customer.visits} visitas
              {customer.spendMinor !== null &&
                ` · ${formatMoney(customer.spendMinor, business.currency)}`}
              {' · '}
              {formatDaysAgo(customer.lastVisitAt).toLowerCase()}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}
