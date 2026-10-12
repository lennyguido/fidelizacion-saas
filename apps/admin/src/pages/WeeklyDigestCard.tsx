import { Link } from 'react-router'
import { errorMessage, weeklyDigest } from '@plataforma/sdk'
import { Alert, Card, Spinner } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { actionLink, useWeeklyDigest } from './weeklyDigestQuery'

/** Tarjeta de Inicio con lo más importante de la semana pasada. Solo dueño/admin. */
export function WeeklyDigestCard() {
  const { business } = useActiveBusiness()
  const digest = useWeeklyDigest(business.id)
  const base = `/b/${business.slug}`

  if (digest.isPending) return <Spinner />
  if (digest.isError) return <Alert tone="error">{errorMessage(digest.error)}</Alert>
  const data = digest.data
  const link = actionLink(base, data.action)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">La semana pasada</h2>
        <Link to={`${base}/semana`} className="text-sm text-slate-600 underline">
          Ver resumen
        </Link>
      </div>
      <p className="text-sm text-slate-700">
        {data.visits} visitas
        {data.baselineVisits !== null && ` (lo normal: ${Math.round(data.baselineVisits)})`} ·{' '}
        {data.newCustomers} nuevos · {data.recoveredCustomers} recuperados
      </p>
      <p className="rounded-lg bg-slate-50 p-3 text-sm font-medium">
        {weeklyDigest.actionText(data.action)}
        {link && (
          <Link to={link.to} className="ml-2 underline">
            {link.label}
          </Link>
        )}
      </p>
    </Card>
  )
}
