import { useState } from 'react'
import { booking, errorMessage, type AgendaItem } from '@plataforma/sdk'
import { Alert, Spinner } from '@plataforma/ui'
import { usePanel } from './context'
import { useAgenda } from './queries'

/** "hoy", "mañana" o "el jueves 16", para el texto del mensaje. */
function dayWords(day: string, today: string): string {
  if (day === today) return 'hoy'
  if (day === booking.addDays(today, 1)) return 'mañana'
  const [y, m, d] = day.split('-').map(Number)
  const weekday = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'long' }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  )
  return `el ${weekday} ${d}`
}

function chipLabel(day: string, today: string): string {
  if (day === today) return 'Hoy'
  if (day === booking.addDays(today, 1)) return 'Mañana'
  return booking.formatDay(day)
}

/**
 * Recordatorios (D-059): los turnos reservados de un día, con el WhatsApp de recordatorio
 * listo para cada cliente. Lo manda el dueño desde su WhatsApp, como en Llenar huecos.
 */
export function RemindersPage() {
  const { business } = usePanel()
  const days = booking.nextDays(business.timezone, 7)
  const today = days[0] ?? ''
  const [day, setDay] = useState(days[1] ?? today)
  const [sent, setSent] = useState<Set<string>>(new Set())

  const agenda = useAgenda(business.id, day)
  const items = (agenda.data ?? [])
    .filter((a) => a.status === 'booked')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recordatorios</h1>
        <p className="max-w-prose text-slate-600">
          Recordale el turno a cada cliente el día anterior y bajá los faltazos. Se abre tu WhatsApp
          con el mensaje listo: lo revisás y lo enviás vos.
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === day}
            onClick={() => setDay(d)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium capitalize ring-1 ring-inset ${
              d === day ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300'
            }`}
          >
            {chipLabel(d, today)}
          </button>
        ))}
      </div>

      {agenda.isPending && <Spinner />}
      {agenda.error && <Alert tone="error">{errorMessage(agenda.error)}</Alert>}
      {agenda.data && items.length === 0 && (
        <p className="rounded-2xl bg-white p-5 text-slate-600 ring-1 ring-slate-200">
          No hay turnos reservados para {dayWords(day, today)}.
        </p>
      )}
      {items.length > 0 && (
        <>
          <p className="text-sm text-slate-600">
            {items.length === 1 ? '1 turno' : `${items.length} turnos`} para {dayWords(day, today)}.
            Mandados: {items.filter((a) => sent.has(a.id)).length}.
          </p>
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {items.map((a) => (
              <ReminderRow
                key={a.id}
                item={a}
                dayText={dayWords(day, today)}
                sent={sent.has(a.id)}
                onSent={() => setSent(new Set(sent).add(a.id))}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function ReminderRow(props: {
  item: AgendaItem
  dayText: string
  sent: boolean
  onSent: () => void
}) {
  const { business } = usePanel()
  const { item, dayText, sent, onSent } = props
  const time = booking.formatTime(item.startsAt, business.timezone)
  const href = item.customerPhone
    ? booking.whatsappLink(
        item.customerPhone,
        booking.reminderMessage({
          clientName: item.customerName,
          businessName: business.name,
          day: dayText,
          time,
          serviceName: item.serviceName,
          staffName: item.staffName,
        }),
      )
    : null

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="font-medium">
          {time} · {item.customerName}
        </p>
        <p className="text-sm text-slate-500">
          {item.serviceName} con {item.staffName}
        </p>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={onSent}
          className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ${
            sent ? 'bg-slate-100 text-slate-600' : 'bg-[#1f8f4e] text-white hover:opacity-90'
          }`}
        >
          {sent ? 'Abierto en WhatsApp ✓' : 'Mandar recordatorio'}
        </a>
      ) : (
        <span className="text-sm text-slate-400">Sin teléfono cargado</span>
      )}
    </li>
  )
}
