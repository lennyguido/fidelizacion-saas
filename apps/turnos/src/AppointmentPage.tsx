import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { booking, errorMessage, type AppointmentView } from '@plataforma/sdk'
import { Alert, Button, FullPageSpinner, Spinner } from '@plataforma/ui'

const STATUS_TEXT = {
  booked: 'Tu turno está confirmado',
  cancelled: 'Turno cancelado',
  attended: '¡Gracias por venir!',
  no_show: 'Este turno quedó como ausente',
} as const

const CANCEL_TEXT = {
  cancelled: 'Listo, cancelamos tu turno.',
  too_late: 'Ya no se puede cancelar online: escribile al negocio.',
  not_booked: 'Este turno ya no está pendiente.',
  not_found: 'No encontramos este turno.',
} as const

/** Ver o cancelar el turno con el link secreto (turnos.neriva.net/turno#…). */
export function AppointmentPage({ token }: { token: string | null }) {
  const client = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const appt = useQuery({
    queryKey: ['appointment', token],
    queryFn: () => booking.getAppointment(token ?? ''),
    enabled: Boolean(token),
  })
  const cancel = useMutation({
    mutationFn: () => booking.cancelByCustomer(token ?? ''),
    onSuccess: async (result) => {
      setNotice(CANCEL_TEXT[result])
      await client.invalidateQueries({ queryKey: ['appointment', token] })
    },
    onError: (err) => setNotice(errorMessage(err)),
  })

  if (token && appt.isPending) return <FullPageSpinner />
  const a = appt.data
  if (!token || !a) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold">No encontramos este turno</h1>
        <p className="text-slate-600">Revisá que el link esté completo.</p>
      </main>
    )
  }

  const day = booking.formatDay(booking.dayInTimeZone(new Date(a.startsAt), a.timezone))
  const time = booking.formatTime(a.startsAt, a.timezone)

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{STATUS_TEXT[a.status]}</h1>
      {notice && <Alert tone="info">{notice}</Alert>}
      <section className="flex flex-col gap-1 rounded-2xl bg-white p-5">
        <p className="text-sm text-slate-500">{a.businessName}</p>
        <p className="text-xl font-semibold capitalize">
          {day} · {time}
        </p>
        <p className="text-slate-700">
          {a.serviceName} con {a.staffName}
        </p>
      </section>
      {a.status === 'booked' && (
        <p className="text-sm text-slate-600">
          Guardá este link (por ejemplo, mandátelo por WhatsApp a vos mismo) para ver o cancelar tu
          turno.
        </p>
      )}
      {a.canCancel && token && (
        <Reschedule
          token={token}
          view={a}
          onDone={async (text) => {
            setNotice(text)
            await client.invalidateQueries({ queryKey: ['appointment', token] })
          }}
        />
      )}
      {a.canCancel && (
        <Button variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate()}>
          Cancelar turno
        </Button>
      )}
      <a href={`/${a.businessSlug}`} className="text-sm font-medium text-slate-700 underline">
        Sacar otro turno
      </a>
    </main>
  )
}

const RESCHEDULE_TEXT = {
  rescheduled: 'Listo, cambiamos tu turno.',
  taken: 'Ese horario se acaba de ocupar. Elegí otro.',
  too_late: 'Ya no se puede cambiar online: escribile al negocio.',
  not_booked: 'Este turno ya no está pendiente.',
  not_found: 'No encontramos este turno.',
  unavailable: 'El negocio no está tomando cambios online ahora.',
} as const

/** Cambiar el horario sin cancelar (mismo servicio). */
function Reschedule(props: {
  token: string
  view: AppointmentView
  onDone: (text: string) => Promise<void>
}) {
  const { token, view, onDone } = props
  const [open, setOpen] = useState(false)
  const days = booking.nextDays(view.timezone, 14)
  const [day, setDay] = useState(days[0] ?? '')
  const slots = useQuery({
    queryKey: ['reschedule', view.businessSlug, view.serviceId, day],
    queryFn: () => booking.availableSlots(view.businessSlug, view.serviceId, null, day),
    enabled: open && Boolean(day),
  })
  const change = useMutation({
    mutationFn: (startsAt: string) => booking.reschedule(token, startsAt),
    onSuccess: async (result) => {
      await onDone(RESCHEDULE_TEXT[result])
      if (result === 'rescheduled') setOpen(false)
    },
    onError: (err) => void onDone(errorMessage(err)),
  })

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cambiar día u horario
      </Button>
    )
  }
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4">
      <h2 className="font-semibold">Elegí el nuevo horario</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            aria-pressed={d === day}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset ${
              d === day ? 'bg-action text-white ring-action' : 'ring-slate-300'
            }`}
          >
            {booking.formatDay(d)}
          </button>
        ))}
      </div>
      {slots.isPending && <Spinner />}
      {slots.data && slots.data.length === 0 && (
        <p className="text-sm text-slate-600">No hay horarios libres ese día.</p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {slots.data?.map((s) => (
          <button
            key={s.startsAt}
            type="button"
            disabled={change.isPending}
            onClick={() => change.mutate(s.startsAt)}
            className="rounded-full px-3 py-2 text-sm font-medium ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            {booking.formatTime(s.startsAt, view.timezone)}
          </button>
        ))}
      </div>
    </section>
  )
}
