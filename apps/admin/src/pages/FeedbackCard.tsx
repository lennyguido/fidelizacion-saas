import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { feedback } from '@plataforma/sdk'
import { Card } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { formatDateTime } from '../lib/format'

/** Opiniones de los clientes (30 días). Las de 3 o menos, como aviso privado. Dueño/admin. */
export function FeedbackCard() {
  const { business } = useActiveBusiness()
  const list = useQuery({
    queryKey: ['customers', business.id, 'feedback'],
    queryFn: () => feedback.listRecent(business.id),
  })
  if (!list.data || list.data.length === 0) return null

  const average = list.data.reduce((sum, item) => sum + item.rating, 0) / list.data.length
  const low = list.data.filter((item) => feedback.isLowRating(item.rating))

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">Qué opinan tus clientes</h2>
        <p className="text-sm text-slate-600">
          {list.data.length} opiniones en 30 días · promedio {average.toFixed(1)} de 5
        </p>
      </div>
      {low.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-red-700">
            Para atender ({low.length}) — solo lo ves vos
          </h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {low.slice(0, 5).map((item) => (
              <li key={item.id} className="py-2">
                <Link
                  to={`/b/${business.slug}/clientes/${item.customerId}`}
                  className="font-medium underline"
                >
                  {item.customerName}
                </Link>{' '}
                <span aria-label={`${item.rating} de 5`}>{'★'.repeat(item.rating)}</span>
                <span className="ml-2 text-slate-400">
                  {formatDateTime(item.createdAt, business.timezone)}
                </span>
                {item.comment && <p className="text-slate-600">"{item.comment}"</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
