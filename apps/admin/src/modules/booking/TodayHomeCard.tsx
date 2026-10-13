import { Link } from 'react-router'
import { booking } from '@plataforma/sdk'
import { Card } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useAgenda } from './queries'

/** Inicio: turnos de hoy (D-049). */
export function TodayHomeCard() {
  const { business } = useActiveBusiness()
  const today = booking.dayInTimeZone(new Date(), business.timezone)
  const agenda = useAgenda(business.id, today)
  const pending = (agenda.data ?? []).filter((a) => a.status === 'booked').length

  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Turnos de hoy</h2>
        <p className="text-sm text-slate-600">
          {pending === 0 ? 'No hay turnos pendientes hoy.' : `${pending} turnos pendientes hoy.`}
        </p>
      </div>
      <Link
        to={`/b/${business.slug}/turnos`}
        className="shrink-0 rounded-full bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover"
      >
        Ver agenda
      </Link>
    </Card>
  )
}
