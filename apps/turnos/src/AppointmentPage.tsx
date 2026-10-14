import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { booking, businesses, errorMessage, type AppointmentView } from '@plataforma/sdk'
import { Alert, FullPageSpinner, Spinner } from '@plataforma/ui'
import { brandStyle } from './brand'

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

/** Ver, guardar, cambiar o cancelar el turno con el link secreto (turnos.neriva.net/turno#…). */
export function AppointmentPage({ token }: { token: string | null }) {
  const client = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const appt = useQuery({
    queryKey: ['appointment', token],
    queryFn: () => booking.getAppointment(token ?? ''),
    enabled: Boolean(token),
  })
  const refresh = async (text: string) => {
    setNotice(text)
    await client.invalidateQueries({ queryKey: ['appointment', token] })
  }

  if (token && appt.isPending) return <FullPageSpinner />
  const a = appt.data
  if (!token || !a) {
    return (
      <main className="book min-h-dvh" style={brandStyle(null)}>
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-5 py-16">
          <h1 className="display text-4xl font-bold">No encontramos este turno</h1>
          <p className="opacity-70">Revisá que el link esté completo.</p>
        </div>
      </main>
    )
  }

  const day = booking.formatDay(booking.dayInTimeZone(new Date(a.startsAt), a.timezone))
  const time = booking.formatTime(a.startsAt, a.timezone)
  const logo = businesses.logoUrl(a.logoPath ?? null)
  const pending = a.status === 'booked'

  return (
    <main className="book min-h-dvh pb-16" style={brandStyle(a.color)}>
      <header className="bg-[var(--brand)] text-[var(--on-brand)]">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-10 pb-8">
          {logo && (
            <img
              src={logo}
              alt=""
              className="h-14 w-14 rounded-2xl object-cover ring-2 ring-[var(--on-brand)]/30"
            />
          )}
          <p className="text-sm font-semibold opacity-80">{STATUS_TEXT[a.status]}</p>
          <div>
            <p className="display text-[clamp(2.4rem,11vw,3.75rem)] font-bold capitalize">
              {day}
            </p>
            <p className="display text-[clamp(2.4rem,11vw,3.75rem)] font-bold">{time}</p>
          </div>
          <p className="text-lg">
            {a.serviceName} con {a.staffName} · {a.businessName}
          </p>
          {a.message && <p className="max-w-[40ch] opacity-90">{a.message}</p>}
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 pt-5">
        {notice && <Alert tone="info">{notice}</Alert>}
        {pending && <SaveIt token={token} view={a} />}
        {a.canCancel && <Reschedule token={token} view={a} onDone={refresh} />}
        {a.canCancel && <CancelIt token={token} businessName={a.businessName} onDone={refresh} />}
        {pending && !a.canCancel && (
          <p className="px-1 text-sm opacity-70">
            Para cambiar o cancelar a esta altura, escribile a {a.businessName}.
          </p>
        )}
        <a
          href={`/${a.businessSlug}`}
          className="flex min-h-11 items-center px-1 text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline"
        >
          Sacar otro turno
        </a>
      </div>
    </main>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-white p-5">
      <h2 className="display text-2xl font-bold">{title}</h2>
      {children}
    </section>
  )
}

const actionClass =
  'flex h-12 items-center justify-center rounded-full px-5 font-semibold ring-1 ring-[var(--line)] ring-inset hover:ring-[var(--brand)]'

/** Guardar el turno: calendario, WhatsApp o mail. */
function SaveIt({ token, view }: { token: string; view: AppointmentView }) {
  const link = `${window.location.origin}${booking.appointmentPath(token)}`
  const whatsappText = `Mi turno en ${view.businessName}: ${booking.formatDay(
    booking.dayInTimeZone(new Date(view.startsAt), view.timezone),
  )} a las ${booking.formatTime(view.startsAt, view.timezone)}. Para verlo o cancelarlo: ${link}`

  const downloadIcs = () => {
    const blob = new Blob([booking.appointmentIcs(view, link)], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'turno.ics'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Panel title="Guardá tu turno">
      <p className="text-sm opacity-70">
        Con este link podés ver, cambiar o cancelar el turno. Guardalo donde te quede cómodo.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={downloadIcs} className={actionClass}>
          Agregar a mi calendario
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noreferrer"
          className={actionClass}
        >
          Mandármelo por WhatsApp
        </a>
      </div>
      <EmailIt token={token} />
    </Panel>
  )
}

const EMAIL_TEXT: Record<string, string> = {
  invalid_email: 'Escribí un mail como nombre@gmail.com.',
  not_found: 'No encontramos este turno.',
  limit: 'Ya te lo mandamos varias veces. Revisá también la carpeta de spam.',
}

function EmailIt({ token }: { token: string }) {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const send = useMutation({
    mutationFn: async () => {
      const queued = await booking.sendByEmail(token, email)
      if (queued !== 'queued') return { ok: false, text: EMAIL_TEXT[queued] ?? EMAIL_TEXT.not_found! }
      const res = await fetch('/api/send-email', { method: 'POST' }).catch(() => null)
      const body = (res?.ok ? await res.json().catch(() => null) : null) as {
        configured?: boolean
        sent?: number
      } | null
      if (body?.configured === false) {
        return {
          ok: false,
          text: 'Por ahora no podemos mandar mails. Guardalo por WhatsApp o en tu calendario.',
        }
      }
      return { ok: true, text: `Listo: te lo mandamos a ${email.trim().toLowerCase()}.` }
    },
    onSuccess: setResult,
    onError: (err) => setResult({ ok: false, text: errorMessage(err) }),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setResult(null)
    if (send.isPending) return
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setResult({ ok: false, text: 'Escribí un mail como nombre@gmail.com.' })
      document.getElementById('appt-email')?.focus()
      return
    }
    send.mutate()
  }

  if (result?.ok) {
    return <p className="rounded-2xl bg-[var(--paper)] p-4 text-sm font-semibold">{result.text}</p>
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="appt-email" className="text-sm font-semibold">
        O mandámelo por mail
      </label>
      <div className="flex gap-2">
        <input
          id="appt-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          placeholder="nombre@gmail.com"
          aria-invalid={Boolean(result && !result.ok)}
          aria-describedby={result ? 'appt-email-error' : undefined}
          onChange={(e) => {
            setEmail(e.target.value)
            if (result) setResult(null)
          }}
          className="h-12 min-w-0 flex-1 rounded-xl bg-[var(--paper)] px-4 text-base"
        />
        <button
          type="submit"
          aria-busy={send.isPending}
          className="h-12 shrink-0 rounded-full bg-[var(--brand)] px-5 font-semibold text-[var(--on-brand)]"
        >
          {send.isPending ? 'Mandando…' : 'Mandar'}
        </button>
      </div>
      {result && (
        <p id="appt-email-error" className="text-sm text-red-700">
          {result.text}
        </p>
      )}
    </form>
  )
}

/** Cancelar con confirmación (no se puede deshacer). */
function CancelIt(props: {
  token: string
  businessName: string
  onDone: (text: string) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const cancel = useMutation({
    mutationFn: () => booking.cancelByCustomer(props.token),
    onSuccess: async (result) => {
      setConfirming(false)
      await props.onDone(CANCEL_TEXT[result])
    },
    onError: (err) => void props.onDone(errorMessage(err)),
  })

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-12 rounded-full font-semibold text-red-700 ring-1 ring-red-200 ring-inset hover:bg-red-50"
      >
        Cancelar turno
      </button>
    )
  }
  return (
    <section
      role="alertdialog"
      aria-labelledby="cancel-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setConfirming(false)
      }}
      className="flex flex-col gap-3 rounded-3xl bg-white p-5 ring-2 ring-red-200"
    >
      <p id="cancel-title" className="font-semibold">
        ¿Cancelar tu turno en {props.businessName}? El horario queda libre para otra persona.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          autoFocus
          onClick={() => setConfirming(false)}
          className="h-12 rounded-full font-semibold ring-1 ring-[var(--line)] ring-inset"
        >
          Mantener turno
        </button>
        <button
          type="button"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate()}
          className="h-12 rounded-full bg-red-700 font-semibold text-white disabled:opacity-50"
        >
          {cancel.isPending ? 'Cancelando…' : 'Cancelar turno'}
        </button>
      </div>
    </section>
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
      <button type="button" onClick={() => setOpen(true)} className={actionClass}>
        Cambiar día u horario
      </button>
    )
  }
  return (
    <Panel title="Elegí el nuevo horario">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            aria-pressed={d === day}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold capitalize ${
              d === day ? 'bg-[var(--brand)] text-[var(--on-brand)]' : 'bg-[var(--paper)]'
            }`}
          >
            {booking.formatDay(d)}
          </button>
        ))}
      </div>
      {slots.isPending && <Spinner />}
      {slots.data && slots.data.length === 0 && (
        <p className="text-sm opacity-70">No hay horarios libres ese día. Probá con otro.</p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {slots.data?.map((s) => (
          <button
            key={s.startsAt}
            type="button"
            disabled={change.isPending}
            onClick={() => change.mutate(s.startsAt)}
            className="min-h-11 rounded-xl py-3 text-[15px] font-semibold tabular-nums ring-1 ring-[var(--line)] ring-inset hover:ring-[var(--brand)]"
          >
            {booking.formatTime(s.startsAt, view.timezone)}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="min-h-11 self-start text-sm font-semibold opacity-70"
      >
        Dejar como está
      </button>
    </Panel>
  )
}
