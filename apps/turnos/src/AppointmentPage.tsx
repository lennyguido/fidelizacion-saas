import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { booking, errorMessage } from '@plataforma/sdk'
import { Alert, Button, FullPageSpinner } from '@plataforma/ui'

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
