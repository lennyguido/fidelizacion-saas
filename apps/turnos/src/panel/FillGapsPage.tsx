import { useState } from 'react'
import { booking, errorMessage, type GapSlot, type LapsedClient } from '@plataforma/sdk'
import { Alert, Spinner } from '@plataforma/ui'
import { usePanel } from './context'
import { useGapSlots, useLapsedClients } from './queries'

const DISCOUNTS = [0, 10, 15, 20, 25, 30]
const AWAY_OPTIONS = [21, 30, 45, 60]

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
 * Llenar huecos (D-053): horarios libres del día + clientes que no vienen hace rato y
 * aceptaron promociones. El dueño les manda la oferta desde su WhatsApp con un toque.
 */
export function FillGapsPage() {
  const { business } = usePanel()
  const days = booking.nextDays(business.timezone, 7)
  const today = days[0] ?? ''
  const [day, setDay] = useState(today)
  const [discount, setDiscount] = useState(20)
  const [minDays, setMinDays] = useState(30)
  const [picked, setPicked] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  const slots = useGapSlots(business.id, day)
  const clients = useLapsedClients(business.id, minDays)
  const slot = slots.data?.find((s) => s.startsAt === picked) ?? slots.data?.[0] ?? null

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Llenar huecos</h1>
        <p className="max-w-prose text-slate-600">
          Elegí un horario libre y mandale una oferta a quien no viene hace rato. Se abre tu
          WhatsApp con el mensaje listo: lo revisás y lo enviás vos.
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === day}
            onClick={() => {
              setDay(d)
              setPicked(null)
            }}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium capitalize ring-1 ring-inset ${
              d === day ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300'
            }`}
          >
            {chipLabel(d, today)}
          </button>
        ))}
      </div>

      <SlotPicker
        slots={slots.data}
        loading={slots.isPending}
        error={slots.error}
        selected={slot?.startsAt ?? null}
        onPick={setPicked}
      />

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Descuento
          <select
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3"
          >
            {DISCOUNTS.map((p) => (
              <option key={p} value={p}>
                {p === 0 ? 'Sin descuento' : `${p}%`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Clientes que no vienen hace
          <select
            value={minDays}
            onChange={(e) => setMinDays(Number(e.target.value))}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3"
          >
            {AWAY_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} días o más
              </option>
            ))}
          </select>
        </label>
      </div>

      {clients.isPending && <Spinner />}
      {clients.error && <Alert tone="error">{errorMessage(clients.error)}</Alert>}
      {clients.data && clients.data.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold">Nadie para invitar todavía</h2>
          <p className="max-w-prose text-slate-600">
            Acá aparecen los clientes que vinieron, no vuelven hace {minDays} días o más y aceptaron
            recibir promociones. Lo marcan al reservar, o lo marcás vos en su ficha.
          </p>
          <a
            href="/panel/clientes"
            className="inline-flex min-h-11 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white"
          >
            Ir a Clientes
          </a>
        </div>
      )}
      {clients.data && clients.data.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
          {clients.data.map((c) => (
            <ClientRow
              key={c.customerId}
              client={c}
              slot={slot}
              offerDay={dayWords(day, today)}
              discount={discount}
              sent={sent.has(c.customerId)}
              onSent={() => setSent(new Set(sent).add(c.customerId))}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function SlotPicker(props: {
  slots: GapSlot[] | undefined
  loading: boolean
  error: unknown
  selected: string | null
  onPick: (startsAt: string) => void
}) {
  const { business } = usePanel()
  const { slots, loading, error, selected, onPick } = props
  if (loading) return <Spinner />
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>
  if (!slots || slots.length === 0) {
    return (
      <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-900">
        Ese día no tiene horarios libres. ¡Agenda llena!
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-600">
        {slots.length === 1 ? 'Queda 1 horario libre' : `Quedan ${slots.length} horarios libres`}{' '}
        (para {slots[0]?.serviceName}). Tocá el que querés ofrecer:
      </p>
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <button
            key={s.startsAt}
            type="button"
            aria-pressed={s.startsAt === selected}
            onClick={() => onPick(s.startsAt)}
            className={`min-h-11 rounded-full px-3 text-sm font-medium ring-1 ring-inset ${
              s.startsAt === selected
                ? 'bg-action text-white ring-action'
                : 'bg-white ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {booking.formatTime(s.startsAt, business.timezone)}
            <span className="ml-1 font-normal opacity-75">· {s.staffName}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ClientRow(props: {
  client: LapsedClient
  slot: GapSlot | null
  offerDay: string
  discount: number
  sent: boolean
  onSent: () => void
}) {
  const { business } = usePanel()
  const { client, slot, offerDay, discount, sent, onSent } = props
  const href = slot
    ? booking.whatsappLink(
        client.phone,
        booking.gapOfferMessage({
          clientName: client.name,
          businessName: business.name,
          day: offerDay,
          time: booking.formatTime(slot.startsAt, business.timezone),
          discountPercent: discount,
          bookingUrl: booking.publicBookingUrl(business.slug),
        }),
      )
    : null

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="font-medium">{client.name}</p>
        <p className="text-sm text-slate-500">
          No viene hace {client.daysAway} días
          {client.lastService ? ` · la última vez: ${client.lastService}` : ''}
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
          {sent ? 'Abierto en WhatsApp ✓' : 'Mandar oferta'}
        </a>
      ) : (
        <span className="text-sm text-slate-400">Elegí un día con lugar</span>
      )}
    </li>
  )
}
