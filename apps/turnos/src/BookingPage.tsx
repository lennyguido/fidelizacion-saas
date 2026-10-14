import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
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
import { Alert, FullPageSpinner, Spinner } from '@plataforma/ui'
import { brandStyle } from './brand'

const BOOK_MESSAGES: Record<string, string> = {
  taken: 'Ese horario se acaba de ocupar. Elegí otro.',
  invalid_name: 'Revisá tu nombre.',
  invalid_phone: 'Revisá tu celular.',
  terms_required: 'Tenés que aceptar para seguir.',
  rate_limited: 'Hay muchas reservas en este momento. Probá en unos minutos.',
  unavailable: 'Este negocio no está tomando turnos online ahora.',
}

function formatPrice(minor: number): string {
  return `$${Math.round(minor / 100).toLocaleString('es-AR')}`
}

function scrollToEl(el: HTMLElement | null) {
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

/** Reservar un turno: servicio → profesional → día y hora → datos. */
export function BookingPage({ slug }: { slug: string }) {
  const page = useQuery({ queryKey: ['booking', slug], queryFn: () => booking.getPublicPage(slug) })

  if (page.isPending) return <FullPageSpinner />
  if (page.error || !page.data) {
    return (
      <main className="book min-h-dvh" style={brandStyle(null)}>
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-5 py-16">
          {page.error ? (
            <Alert tone="error">{errorMessage(page.error)}</Alert>
          ) : (
            <>
              <h1 className="display text-4xl font-bold">No encontramos este negocio</h1>
              <p className="opacity-70">Revisá el link o pedíselo de nuevo al negocio.</p>
            </>
          )}
        </div>
      </main>
    )
  }
  return <Booking slug={slug} page={page.data} />
}

function Booking({ slug, page }: { slug: string; page: PublicPage }) {
  const askStaff = page.staff.length > 1
  const [service, setService] = useState<PublicService | null>(
    page.services.length === 1 ? (page.services[0] ?? null) : null,
  )
  const [staffId, setStaffId] = useState<string | null>(null)
  const [staffChosen, setStaffChosen] = useState(!askStaff)
  const [slot, setSlot] = useState<Slot | null>(null)
  const logo = businesses.logoUrl(page.logoPath)
  const staffName = page.staff.find((s) => s.id === staffId)?.name ?? 'El primero libre'

  const staffRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLElement>(null)
  const formRef = useRef<HTMLElement>(null)
  const step = !service ? 'service' : !staffChosen ? 'staff' : !slot ? 'time' : 'form'
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (step === 'staff') scrollToEl(staffRef.current)
    if (step === 'time') scrollToEl(timeRef.current)
    if (step === 'form') scrollToEl(formRef.current)
  }, [step])

  return (
    <main className="book min-h-dvh pb-40" style={brandStyle(page.color)}>
      <header className="bg-[var(--brand)] text-[var(--on-brand)]">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-10 pb-8">
          {logo && (
            <img
              src={logo}
              alt=""
              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-[var(--on-brand)]/30"
            />
          )}
          <div>
            <p className="text-sm font-semibold opacity-80">Reservá tu turno en</p>
            <h1 className="display mt-1 text-[clamp(2.6rem,12vw,4.25rem)] font-bold break-words">
              {page.name}
            </h1>
          </div>
          {page.message && (
            <p className="max-w-[40ch] leading-relaxed opacity-90">{page.message}</p>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 pt-5">
        {page.services.length === 0 ? (
          <Alert tone="info">Este negocio todavía no cargó sus servicios.</Alert>
        ) : service && step !== 'service' ? (
          <Done
            label="Servicio"
            value={`${service.name} · ${service.durationMinutes} min`}
            onChange={() => {
              setService(null)
              setSlot(null)
            }}
          />
        ) : (
          <Panel title="¿Qué te querés hacer?">
            <ul className="flex flex-col">
              {page.services.map((s) => (
                <li key={s.id} className="border-t border-[var(--line)] first:border-t-0">
                  <button
                    type="button"
                    onClick={() => {
                      setService(s)
                      setSlot(null)
                    }}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  >
                    <span>
                      <span className="block text-lg font-semibold">{s.name}</span>
                      <span className="block text-sm opacity-60">{s.durationMinutes} min</span>
                    </span>
                    <span className="flex items-center gap-3">
                      {s.priceMinor !== null && (
                        <span className="font-semibold tabular-nums">
                          {formatPrice(s.priceMinor)}
                        </span>
                      )}
                      <span className="flex h-9 items-center rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--on-brand)]">
                        Elegir
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {service && askStaff && (
          <section ref={staffRef} className="scroll-mt-4">
            {staffChosen ? (
              <Done
                label="Con"
                value={staffName}
                onChange={() => {
                  setStaffChosen(false)
                  setSlot(null)
                }}
              />
            ) : (
              <Panel title="¿Con quién?">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  <StaffChoice
                    name="El primero libre"
                    initials="✦"
                    onClick={() => {
                      setStaffId(null)
                      setStaffChosen(true)
                    }}
                  />
                  {page.staff.map((s) => (
                    <StaffChoice
                      key={s.id}
                      name={s.name}
                      initials={s.name.slice(0, 1).toUpperCase()}
                      onClick={() => {
                        setStaffId(s.id)
                        setStaffChosen(true)
                      }}
                    />
                  ))}
                </div>
              </Panel>
            )}
          </section>
        )}

        {service && staffChosen && (
          <section ref={timeRef} className="scroll-mt-4">
            <SlotPicker
              slug={slug}
              page={page}
              service={service}
              staffId={staffId}
              selected={slot}
              onSelect={setSlot}
            />
          </section>
        )}

        {service && slot && (
          <section ref={formRef} className="scroll-mt-4">
            <ContactForm
              slug={slug}
              page={page}
              service={service}
              staffId={staffId}
              slot={slot}
              onTaken={() => setSlot(null)}
            />
          </section>
        )}

        <p className="pt-8 text-center text-xs opacity-50">
          Reservas con{' '}
          <a href="https://turnos.neriva.net" className="underline">
            Neriva Turnos
          </a>
        </p>
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

/** Paso ya elegido: queda como una línea con "Cambiar". */
function Done({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-5 py-3">
      <p className="min-w-0">
        <span className="block text-xs font-semibold opacity-50">{label}</span>
        <span className="block truncate font-semibold">{value}</span>
      </p>
      <button
        type="button"
        onClick={onChange}
        className="-mr-2 min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline"
      >
        Cambiar
      </button>
    </div>
  )
}

function StaffChoice(props: { name: string; initials: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center hover:bg-[var(--paper)]"
    >
      <span className="display flex h-16 w-16 items-center justify-center rounded-full bg-[var(--paper)] text-2xl font-bold ring-2 ring-transparent group-hover:ring-[var(--brand)]">
        {props.initials}
      </span>
      <span className="text-sm leading-tight font-semibold">{props.name}</span>
    </button>
  )
}

const PARTS: [string, (m: number) => boolean][] = [
  ['Mañana', (m) => m < 12 * 60],
  ['Tarde', (m) => m >= 12 * 60 && m < 19 * 60],
  ['Noche', (m) => m >= 19 * 60],
]

function dayParts(day: string): { top: string; num: string; month: string } {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', ...o }).format(date).replace('.', '')
  return { top: fmt({ weekday: 'short' }), num: String(d), month: fmt({ month: 'short' }) }
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
  const today = days[0] ?? ''
  const [day, setDay] = useState(today)
  const slots = useQuery({
    queryKey: ['booking', slug, 'slots', service.id, staffId, day],
    queryFn: () => booking.availableSlots(slug, service.id, staffId, day),
    enabled: Boolean(day),
  })

  return (
    <Panel title="¿Qué día y a qué hora?">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {days.map((d) => {
          const p = dayParts(d)
          const on = d === day
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={booking.formatDay(d)}
              onClick={() => {
                setDay(d)
                onSelect(null)
              }}
              className={`flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5 ${
                on ? 'bg-[var(--brand)] text-[var(--on-brand)]' : 'bg-[var(--paper)]'
              }`}
            >
              <span className="text-xs font-semibold capitalize opacity-75">
                {d === today ? 'Hoy' : p.top}
              </span>
              <span className="display text-3xl font-bold">{p.num}</span>
              <span className="text-xs capitalize opacity-75">{p.month}</span>
            </button>
          )
        })}
      </div>

      {slots.isPending && <Spinner />}
      {slots.error && <Alert tone="error">{errorMessage(slots.error)}</Alert>}
      {slots.data && slots.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--paper)] p-4 text-center">
          <p className="opacity-80">No quedan horarios este día.</p>
          {days.indexOf(day) < days.length - 1 && (
            <button
              type="button"
              onClick={() => setDay(days[days.indexOf(day) + 1] ?? day)}
              className="min-h-11 rounded-full bg-[var(--brand)] px-5 font-semibold text-[var(--on-brand)]"
            >
              Ver el día siguiente
            </button>
          )}
        </div>
      )}
      {slots.data &&
        PARTS.map(([label, inPart]) => {
          const list = slots.data.filter((s) =>
            inPart(booking.minutesOfDay(s.startsAt, page.timezone)),
          )
          if (list.length === 0) return null
          return (
            <div key={label} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold opacity-60">{label}</h3>
              <div className="grid grid-cols-4 gap-2">
                {list.map((s) => {
                  const on = selected?.startsAt === s.startsAt
                  return (
                    <button
                      key={s.startsAt}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onSelect(s)}
                      className={`min-h-11 rounded-xl py-3 text-[15px] font-semibold tabular-nums ${
                        on
                          ? 'bg-[var(--brand)] text-[var(--on-brand)]'
                          : 'ring-1 ring-[var(--line)] ring-inset hover:ring-[var(--brand)]'
                      }`}
                    >
                      {booking.formatTime(s.startsAt, page.timezone)}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
    </Panel>
  )
}

const DRAFT_KEY = 'neriva-turnos-datos'

/** Nombre y celular guardados en este dispositivo para la próxima reserva. */
function loadDraft(): { name: string; phone: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, unknown>
    return {
      name: typeof raw.name === 'string' ? raw.name : '',
      phone: typeof raw.phone === 'string' ? raw.phone : '',
    }
  } catch {
    return { name: '', phone: '' }
  }
}

function saveDraft(name: string, phone: string) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, phone }))
  } catch {
    // Sin almacenamiento (modo privado): no pasa nada.
  }
}

type FieldName = 'name' | 'phone' | 'terms'

function ContactForm(props: {
  slug: string
  page: PublicPage
  service: PublicService
  staffId: string | null
  slot: Slot
  onTaken: () => void
}) {
  const { slug, page, service, staffId, slot, onTaken } = props
  const [draft] = useState(loadDraft)
  const [name, setName] = useState(draft.name)
  const [phone, setPhone] = useState(draft.phone)
  const [terms, setTerms] = useState(false)
  const [promos, setPromos] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [shown, setShown] = useState<Set<FieldName>>(new Set())
  const normalized = normalizePhone(phone)

  const problems: Record<FieldName, string | null> = {
    name: name.trim().length < 2 ? 'Escribí tu nombre y apellido.' : null,
    phone:
      normalized === null ? 'Escribí tu celular con característica, por ejemplo 11 2233 4455.' : null,
    terms: terms ? null : 'Marcá esta casilla para poder guardar tu turno.',
  }
  const errorOf = (f: FieldName) => (shown.has(f) ? problems[f] : null)
  const show = (f: FieldName) => setShown((prev) => new Set(prev).add(f))
  const hide = (f: FieldName) =>
    setShown((prev) => {
      const next = new Set(prev)
      next.delete(f)
      return next
    })

  useEffect(() => saveDraft(name, phone), [name, phone])

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
        promos,
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
    const first = (['name', 'phone', 'terms'] as FieldName[]).find((f) => problems[f])
    if (first) {
      setShown(new Set(['name', 'phone', 'terms'] as FieldName[]))
      document.getElementById(`reserva-${first}`)?.focus()
      return
    }
    book.mutate()
  }

  const when = `${booking.formatDay(booking.dayInTimeZone(new Date(slot.startsAt), page.timezone))} · ${booking.formatTime(slot.startsAt, page.timezone)}`

  return (
    <Panel title="Tus datos">
      <form id="reserva" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {message && <Alert tone="error">{message}</Alert>}
        <Field label="Nombre y apellido" htmlFor="reserva-name" error={errorOf('name')}>
          <input
            id="reserva-name"
            autoComplete="name"
            maxLength={60}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              hide('name')
            }}
            onBlur={() => show('name')}
            aria-invalid={Boolean(errorOf('name'))}
            className="h-12 w-full rounded-xl bg-[var(--paper)] px-4 text-base"
          />
        </Field>
        <Field
          label="Celular"
          htmlFor="reserva-phone"
          hint="Para avisarte si hay algún cambio."
          error={errorOf('phone')}
        >
          <input
            id="reserva-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="11 2233 4455"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              hide('phone')
            }}
            onBlur={() => show('phone')}
            aria-invalid={Boolean(errorOf('phone'))}
            className="h-12 w-full rounded-xl bg-[var(--paper)] px-4 text-base"
          />
        </Field>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 text-sm">
            <input
              id="reserva-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => {
                setTerms(e.target.checked)
                hide('terms')
              }}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span className="opacity-80">
              Acepto que {page.name} guarde mi nombre y celular para gestionar mis turnos y
              contactarme por ellos.
            </span>
          </label>
          {errorOf('terms') && <p className="pl-8 text-sm text-red-700">{errorOf('terms')}</p>}
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={promos}
            onChange={(e) => setPromos(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span className="opacity-80">
            Avisame por WhatsApp de descuentos y lugares libres (opcional).
          </span>
        </label>
      </form>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--line)] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-semibold">{service.name}</span>
            <span className="block truncate capitalize opacity-60">{when}</span>
          </p>
          <button
            type="submit"
            form="reserva"
            aria-busy={book.isPending}
            className="h-12 shrink-0 rounded-full bg-[var(--brand)] px-6 font-semibold text-[var(--on-brand)]"
          >
            {book.isPending ? 'Reservando…' : 'Confirmar turno'}
          </button>
        </div>
      </div>
    </Panel>
  )
}

function Field(props: {
  label: string
  htmlFor: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={props.htmlFor} className="text-sm font-semibold">
        {props.label}
      </label>
      {props.children}
      {props.error ? (
        <p className="text-sm text-red-700">{props.error}</p>
      ) : (
        props.hint && <p className="text-sm opacity-60">{props.hint}</p>
      )}
    </div>
  )
}
