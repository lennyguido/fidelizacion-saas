import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  booking,
  businesses,
  errorMessage,
  normalizePhone,
  type PublicPage,
  type PublicService,
  type Slot,
} from '@plataforma/sdk'
import { Alert, Button, FullPageSpinner, Spinner, TextField } from '@plataforma/ui'

const BOOK_MESSAGES: Record<string, string> = {
  taken: 'Ese horario se acaba de ocupar. Elegí otro.',
  invalid_name: 'Revisá tu nombre.',
  invalid_phone: 'Revisá tu celular.',
  terms_required: 'Tenés que aceptar para seguir.',
  rate_limited: 'Hay muchas reservas en este momento. Probá en unos minutos.',
  unavailable: 'Este negocio no está tomando turnos online ahora.',
}

/** Reservar un turno: servicio → profesional → día y hora → datos. */
export function BookingPage({ slug }: { slug: string }) {
  const page = useQuery({ queryKey: ['booking', slug], queryFn: () => booking.getPublicPage(slug) })

  if (page.isPending) return <FullPageSpinner />
  if (page.error) {
    return (
      <Shell>
        <Alert tone="error">{errorMessage(page.error)}</Alert>
      </Shell>
    )
  }
  if (!page.data) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">No encontramos este negocio</h1>
        <p className="text-slate-600">Revisá el link o pedíselo de nuevo al negocio.</p>
      </Shell>
    )
  }
  return <Booking slug={slug} page={page.data} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-8">{children}</main>
}

function Booking({ slug, page }: { slug: string; page: PublicPage }) {
  const [service, setService] = useState<PublicService | null>(
    page.services.length === 1 ? (page.services[0] ?? null) : null,
  )
  const [staffId, setStaffId] = useState<string | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  const logo = businesses.logoUrl(page.logoPath)

  return (
    <Shell>
      <header className="flex items-center gap-3">
        {logo && <img src={logo} alt="" className="h-12 w-12 rounded-xl object-cover" />}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{page.name}</h1>
          <p className="text-sm text-slate-500">Sacá tu turno</p>
        </div>
      </header>
      {page.message && <p className="rounded-2xl bg-white p-4 text-sm">{page.message}</p>}

      {page.services.length === 0 ? (
        <Alert tone="info">Este negocio todavía no cargó sus servicios.</Alert>
      ) : (
        <Step title="1. ¿Qué te querés hacer?">
          <div className="flex flex-col gap-2">
            {page.services.map((s) => (
              <Choice
                key={s.id}
                selected={service?.id === s.id}
                onClick={() => {
                  setService(s)
                  setSlot(null)
                }}
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-slate-500">
                  {s.durationMinutes} min
                  {s.priceMinor !== null && ` · ${formatPrice(s.priceMinor)}`}
                </span>
              </Choice>
            ))}
          </div>
        </Step>
      )}

      {service && page.staff.length > 1 && (
        <Step title="2. ¿Con quién?">
          <div className="flex flex-wrap gap-2">
            <Pill selected={staffId === null} onClick={() => pickStaff(null)}>
              Cualquiera
            </Pill>
            {page.staff.map((s) => (
              <Pill key={s.id} selected={staffId === s.id} onClick={() => pickStaff(s.id)}>
                {s.name}
              </Pill>
            ))}
          </div>
        </Step>
      )}

      {service && (
        <SlotPicker
          slug={slug}
          page={page}
          service={service}
          staffId={staffId}
          selected={slot}
          onSelect={setSlot}
        />
      )}

      {service && slot && (
        <ContactForm
          slug={slug}
          page={page}
          service={service}
          staffId={staffId}
          slot={slot}
          onTaken={() => setSlot(null)}
        />
      )}
    </Shell>
  )

  function pickStaff(id: string | null) {
    setStaffId(id)
    setSlot(null)
  }
}

function SlotPicker(props: {
  slug: string
  page: PublicPage
  service: PublicService
  staffId: string | null
  selected: Slot | null
  onSelect: (slot: Slot | null) => void
}) {
  const { slug, page, service, staffId, selected, onSelect } = props
  const days = booking.nextDays(page.timezone, Math.min(page.maxDaysAhead + 1, 21))
  const [day, setDay] = useState(days[0] ?? '')
  const slots = useQuery({
    queryKey: ['booking', slug, 'slots', service.id, staffId, day],
    queryFn: () => booking.availableSlots(slug, service.id, staffId, day),
    enabled: Boolean(day),
  })

  return (
    <Step title="3. Elegí día y hora">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          <Pill
            key={d}
            selected={d === day}
            onClick={() => {
              setDay(d)
              onSelect(null)
            }}
          >
            {booking.formatDay(d)}
          </Pill>
        ))}
      </div>
      {slots.isPending && <Spinner />}
      {slots.error && <Alert tone="error">{errorMessage(slots.error)}</Alert>}
      {slots.data && slots.data.length === 0 && (
        <p className="text-sm text-slate-600">No quedan horarios este día. Probá otro.</p>
      )}
      {slots.data && slots.data.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {slots.data.map((s) => (
            <Pill
              key={s.startsAt}
              selected={selected?.startsAt === s.startsAt}
              onClick={() => onSelect(s)}
            >
              {booking.formatTime(s.startsAt, page.timezone)}
            </Pill>
          ))}
        </div>
      )}
    </Step>
  )
}

function ContactForm(props: {
  slug: string
  page: PublicPage
  service: PublicService
  staffId: string | null
  slot: Slot
  onTaken: () => void
}) {
  const { slug, page, service, staffId, slot, onTaken } = props
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [terms, setTerms] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const normalized = normalizePhone(phone)
  const phoneInvalid = phone.trim() !== '' && normalized === null

  const book = useMutation({
    mutationFn: () =>
      booking.book({
        slug,
        serviceId: service.id,
        staffId,
        startsAt: slot.startsAt,
        name: name.trim(),
        phone: normalized ?? '',
        termsAccepted: terms,
      }),
    onSuccess: (result) => {
      if (result.status === 'booked' && result.token) {
        window.location.assign(booking.appointmentPath(result.token))
        return
      }
      setMessage(BOOK_MESSAGES[result.status] ?? BOOK_MESSAGES.unavailable!)
      if (result.status === 'taken') onTaken()
    },
    onError: (err) => setMessage(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    book.mutate()
  }

  return (
    <Step title="4. Tus datos">
      <p className="text-sm text-slate-600">
        {service.name} ·{' '}
        {booking.formatDay(booking.dayInTimeZone(new Date(slot.startsAt), page.timezone))} a las{' '}
        {booking.formatTime(slot.startsAt, page.timezone)}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {message && <Alert tone="error">{message}</Alert>}
        <TextField
          label="Nombre y apellido"
          autoComplete="name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Celular"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={
            phoneInvalid ? 'Escribilo con característica, por ejemplo 11 2233 4455.' : undefined
          }
          hint="Para avisarte si hay algún cambio."
        />
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-1"
          />
          <span>
            Acepto que {page.name} guarde mi nombre y celular para gestionar mis turnos y
            contactarme por ellos.
          </span>
        </label>
        <Button
          type="submit"
          size="lg"
          loading={book.isPending}
          disabled={name.trim().length < 2 || normalized === null || !terms}
        >
          Confirmar turno
        </Button>
      </form>
    </Step>
  )
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Choice(props: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left ring-1 ring-inset ${
        props.selected ? 'bg-action/10 ring-action' : 'ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {props.children}
    </button>
  )
}

function Pill(props: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset ${
        props.selected ? 'bg-action text-white ring-action' : 'ring-slate-300 hover:bg-slate-50'
      }`}
    >
      {props.children}
    </button>
  )
}

function formatPrice(minor: number): string {
  return `$${Math.round(minor / 100).toLocaleString('es-AR')}`
}
