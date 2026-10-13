import { Link } from 'react-router'
import { Card } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useReviewTags } from './queries'

/** Inicio: cuántas personas tocaron los carteles de reseñas este mes (D-048). */
export function ReviewTagsHomeCard() {
  const { business } = useActiveBusiness()
  const tags = useReviewTags(business.id)
  if (!tags.data || tags.data.length === 0) return null
  const month = tags.data.reduce((sum, tag) => sum + tag.tapsThisMonth, 0)
  const last = tags.data.reduce((sum, tag) => sum + tag.tapsLastMonth, 0)

  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Carteles de reseñas</h2>
        <p className="text-sm text-slate-600">
          {month === 1 ? '1 persona tocó' : `${month} personas tocaron`} tus carteles este mes
          {last > 0 ? ` (el mes pasado, ${last}).` : '.'}
        </p>
      </div>
      <Link
        to={`/b/${business.slug}/resenas`}
        className="shrink-0 rounded-full px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
      >
        Ver
      </Link>
    </Card>
  )
}
