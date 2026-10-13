import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { booking, errorMessage, formatPhone, type AgendaItem } from '@plataforma/sdk'
import { Alert, Button, Card, EmptyState, Spinner, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useAgenda, useBookingSettings, useInvalidateBooking } from './queries'

const STATUS_LABEL: Record<AgendaItem['status'], string> = {
  booked: 'Pendiente',
  attended: 'Asistió',
  no_show: 'No vino',
  cancelled: 'Cancelado',
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + delta))
  return date.toISOString().slice(0, 10)
}

/** Turnos (D-049): la agenda del día, con asistió / no vino / cancelar. */
export function AgendaPage() {
  const { business } = useActiveBusiness()
  const today = booking.dayInTimeZone(new Date(), business.timezone)
  const [day, setDay] = useState(today)
  const agenda = useAgenda(business.id, day)
  const settings = useBookingSettings(business.id)
  const base = `/b/${business.slug}/turnos`
  const link = booking.publicBookingUrl(business.slug)
  const toast = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.show('Link copiado', 'success')
    } catch {
      toast.show('No se pudo copiar: seleccioná el link y copialo a mano', 'error')
    }
  }

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Turnos</h1>
        {business.role !== 'staff' && (
          <Link to={`${base}/configuracion`} className="text-sm font-medium underline">
            Configurar servicios y horarios
          </Link>
        )}
      </div>

      {settings.data?.enabled ? (
        <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Tu link para reservar</p>
            <p className="truncate font-mono text-sm text-slate-600">{link}</p>
          </div>
          <Button variant="secondary" onClick={() => void copy()}>
            Copiar link
          </Button>
        </Card>
      ) : (
        settings.data !== undefined && (
          <Alert tone="info">
            Los turnos online están apagados. Cargá servicios y horarios y prendelos en{' '}
            <Link to={`${base}/configuracion`} className="underline">
              Configurar
            </Link>
            .
          </Alert>
        )
      )}

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setDay(shiftDay(day, -1))} aria-label="Día anterior">
          ←
        </Button>
        <p className="min-w-40 text-center font-semibold capitalize">
          {day === today ? 'Hoy' : booking.formatDay(day)}
        </p>
        <Button variant="secondary" onClick={() => setDay(shiftDay(day, 1))} aria-label="Día siguiente">
          →
        </Button>
        {day !== today && (
          <Button variant="ghost" onClick={() => setDay(today)}>
            Hoy
          </Button>
        )}
      </div>

      {agenda.isPending && <Spinner />}
      {agenda.error && <Alert tone="error">{errorMessage(agenda.error)}</Alert>}
      {agenda.data && agenda.data.length === 0 && <EmptyState title="No hay turnos este día" />}
      {agenda.data?.map((item) => <AgendaRow key={item.id} item={item} />)}
    </section>
  )
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const { business } = useActiveBusiness()
  const invalidate = useInvalidateBooking(business.id)
  const toast = useToast()
  const update = useMutation({
    mutationFn: (status: 'attended' | 'no_show' | 'cancelled') => booking.setStatus(item.id, status),
    onSuccess: async () => {
      await invalidate()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const pending = item.status === 'booked'

  return (
    <Card className={`flex flex-col gap-3 ${pending ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">
            {booking.formatTime(item.startsAt, business.timezone)} · {item.customerName}
          </p>
          <p className="text-sm text-slate-600">
            {item.serviceName} con {item.staffName}
            {item.customerPhone && ` · ${formatPhone(item.customerPhone)}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      {pending && (
        <div className="flex flex-wrap gap-2">
          <Button loading={update.isPending} onClick={() => update.mutate('attended')}>
            Asistió
          </Button>
          <Button variant="secondary" onClick={() => update.mutate('no_show')}>
            No vino
          </Button>
          <Button variant="ghost" onClick={() => update.mutate('cancelled')}>
            Cancelar
          </Button>
        </div>
      )}
    </Card>
  )
}
