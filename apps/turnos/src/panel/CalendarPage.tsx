import { useEffect, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  booking,
  errorMessage,
  formatPhone,
  normalizePhone,
  type AgendaItem,
} from '@plataforma/sdk'
import { Alert, Button, Spinner, TextField, useToast } from '@plataforma/ui'
import { usePanel } from './context'
import { useHours, useInvalidateBooking, useServices, useStaff, useWeek } from './queries'
import { placeInLanes, staffColor, type StaffColor } from './calendarLayout'

/** Alto de una hora: alcanza para dos líneas en un turno de 30 minutos. */
const HOUR_PX = 88
/** Debajo de este alto el turno se muestra en una sola línea. */
const ONE_LINE_PX = 40
const STATUS_LABEL: Record<AgendaItem['status'], string> = {
  booked: 'Pendiente',
  attended: 'Asistió',
  no_show: 'No vino',
  cancelled: 'Cancelado',
}

/** En pantallas chicas se ve un día a la vez. */
function useIsNarrow() {
  const query = '(max-width: 767px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setNarrow(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return narrow
}

/** Calendario semanal por profesional (D-050). */
export function CalendarPage() {
  const { business } = usePanel()
  const today = booking.dayInTimeZone(new Date(), business.timezone)
  const narrow = useIsNarrow()
  const [focus, setFocus] = useState(today)
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [creating, setCreating] = useState(false)
  const from = booking.weekStart(focus)
  const week = useWeek(business.id, from)
  const staff = useStaff(business.id)
  const hours = useHours(business.id)

  const weekDays = Array.from({ length: 7 }, (_, i) => booking.addDays(from, i))
  const days = narrow ? [focus] : weekDays
  const step = narrow ? 1 : 7
  const staffIds = (staff.data ?? []).map((s) => s.id)
  const dayOf = (iso: string) => booking.dayInTimeZone(new Date(iso), business.timezone)
  const minuteOf = (iso: string) => booking.minutesOfDay(iso, business.timezone)
  const endMinuteOf = (a: AgendaItem) =>
    minuteOf(a.startsAt) + (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000
  const items = (week.data ?? []).filter(
    (a) => a.status !== 'cancelled' && (staffFilter === 'all' || a.staffId === staffFilter),
  )
  const ranges = hours.data ?? []
  const startHour = Math.min(8, ...ranges.map((r) => Number(r.startTime.slice(0, 2))))
  const endHour = Math.max(20, ...ranges.map((r) => Math.ceil(Number(r.endTime.slice(0, 2)))))
  const totalPx = (endHour - startHour) * HOUR_PX
  const pending = items.filter(
    (a) => a.status === 'booked' && days.includes(dayOf(a.startsAt)),
  ).length

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => setFocus(booking.addDays(focus, -step))}
          aria-label={narrow ? 'Día anterior' : 'Semana anterior'}
        >
          ←
        </Button>
        <Button
          variant="secondary"
          onClick={() => setFocus(booking.addDays(focus, step))}
          aria-label={narrow ? 'Día siguiente' : 'Semana siguiente'}
        >
          →
        </Button>
        <Button variant="ghost" onClick={() => setFocus(today)}>
          Hoy
        </Button>
        <p className="font-semibold capitalize">
          {narrow
            ? booking.formatDay(focus)
            : `${booking.formatDay(weekDays[0]!)} – ${booking.formatDay(weekDays[6]!)}`}
        </p>
        <span className="text-sm text-slate-500">{pending} pendientes</span>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <select
            aria-label="Profesional"
            className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm sm:flex-none"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {(staff.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setCreating(true)}>Nuevo turno</Button>
        </div>
      </div>

      {staffIds.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600" aria-label="Colores">
          {(staff.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: staffColor(staffIds, s.id).bar }}
              />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      {week.isPending && <Spinner />}
      {week.error && <Alert tone="error">{errorMessage(week.error)}</Alert>}

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <div
          className={`grid ${narrow ? '' : 'min-w-[840px]'}`}
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="border-b border-slate-100" />
          {days.map((d) => (
            <div
              key={d}
              className={`border-b border-l border-slate-100 px-2 py-2 text-center text-sm font-medium capitalize ${
                d === today ? 'text-action' : ''
              }`}
            >
              {booking.formatDay(d)}
            </div>
          ))}
          <div className="relative" style={{ height: totalPx }}>
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <span
                key={i}
                className="absolute right-2 text-xs tabular-nums text-slate-400"
                style={{ top: i === 0 ? 2 : i * HOUR_PX - 7 }}
              >
                {String(startHour + i).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="relative border-l border-slate-100" style={{ height: totalPx }}>
              {Array.from({ length: (endHour - startHour) * 2 }, (_, i) => (
                <div
                  key={i}
                  className={`absolute inset-x-0 border-t ${
                    i % 2 === 0 ? 'border-slate-200' : 'border-dashed border-slate-100'
                  }`}
                  style={{ top: (i * HOUR_PX) / 2 }}
                />
              ))}
              {placeInLanes(
                items.filter((a) => dayOf(a.startsAt) === d),
                (a) => minuteOf(a.startsAt),
                endMinuteOf,
              ).map(({ item: a, lane, lanes }) => {
                const top = ((minuteOf(a.startsAt) - startHour * 60) / 60) * HOUR_PX
                const height = Math.max(
                  24,
                  ((endMinuteOf(a) - minuteOf(a.startsAt)) / 60) * HOUR_PX - 2,
                )
                return (
                  <AppointmentBlock
                    key={a.id}
                    item={a}
                    color={staffColor(staffIds, a.staffId)}
                    timeZone={business.timezone}
                    oneLine={height < ONE_LINE_PX}
                    style={{
                      top: top + 1,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                    onClick={() => setSelected(a)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && <AppointmentSheet item={selected} onClose={() => setSelected(null)} />}
      {creating && <NewAppointmentSheet onClose={() => setCreating(false)} />}
    </section>
  )
}

/** Un turno en la grilla: color del profesional, hora y cliente arriba, servicio abajo. */
function AppointmentBlock({
  item,
  color,
  timeZone,
  oneLine,
  style,
  onClick,
}: {
  item: AgendaItem
  color: StaffColor
  timeZone: string
  oneLine: boolean
  style: React.CSSProperties
  onClick: () => void
}) {
  const time = booking.formatTime(item.startsAt, timeZone)
  const done = item.status === 'attended'
  const noShow = item.status === 'no_show'
  const detail = `${item.serviceName} · ${item.staffName}`
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${time} ${item.customerName} — ${detail} (${STATUS_LABEL[item.status]})`}
      className={`absolute flex overflow-hidden rounded-md border-l-[3px] px-1.5 text-left text-xs leading-tight shadow-sm ring-1 ring-black/5 transition-shadow hover:z-10 hover:shadow-md focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action ${
        oneLine ? 'items-center' : 'flex-col justify-start py-1'
      } ${done ? 'opacity-60' : ''}`}
      style={{
        ...style,
        borderLeftColor: noShow ? '#dc2626' : color.bar,
        background: noShow ? '#fef2f2' : color.bg,
      }}
    >
      <span
        className={`flex min-w-0 items-baseline gap-1 ${noShow ? 'text-red-800 line-through' : 'text-slate-900'}`}
      >
        <span className="shrink-0 tabular-nums text-slate-500">{time}</span>
        <span className="truncate font-semibold">{item.customerName}</span>
        {done && <span aria-label="Asistió">✓</span>}
      </span>
      {!oneLine && <span className="truncate text-slate-600">{detail}</span>}
    </button>
  )
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AppointmentSheet({ item, onClose }: { item: AgendaItem; onClose: () => void }) {
  const { business } = usePanel()
  const invalidate = useInvalidateBooking(business.id)
  const staff = useStaff(business.id)
  const toast = useToast()
  const [moving, setMoving] = useState(false)
  const [day, setDay] = useState(booking.dayInTimeZone(new Date(item.startsAt), business.timezone))
  const [time, setTime] = useState(booking.formatTime(item.startsAt, business.timezone))
  const [staffId, setStaffId] = useState(item.staffId)

  const status = useMutation({
    mutationFn: (next: 'attended' | 'no_show' | 'cancelled') => booking.setStatus(item.id, next),
    onSuccess: async () => {
      await invalidate()
      onClose()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const move = useMutation({
    mutationFn: () =>
      booking.moveAppointment(item.id, staffId, localToIso(day, time, business.timezone)),
    onSuccess: async (result) => {
      if (result === 'taken') {
        toast.show('En ese horario ya hay otro turno', 'error')
        return
      }
      await invalidate()
      toast.show('Turno movido', 'success')
      onClose()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const pending = item.status === 'booked'
  const whatsapp = item.customerPhone
    ? `https://wa.me/${item.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hola ${item.customerName.split(' ')[0]}, te escribimos de ${business.name} por tu turno del ${booking.formatDay(
          booking.dayInTimeZone(new Date(item.startsAt), business.timezone),
        )} a las ${booking.formatTime(item.startsAt, business.timezone)}.`,
      )}`
    : null

  return (
    <Sheet title={item.customerName} onClose={onClose}>
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-base font-medium capitalize">
          {booking.formatDay(booking.dayInTimeZone(new Date(item.startsAt), business.timezone))} ·{' '}
          {booking.formatTime(item.startsAt, business.timezone)}
        </p>
        <p>
          {item.serviceName} con {item.staffName}
        </p>
        {item.customerPhone && <p>{formatPhone(item.customerPhone)}</p>}
        <p className="text-slate-500">
          {STATUS_LABEL[item.status]} ·{' '}
          {item.source === 'online' ? 'Reservó online' : 'Cargado en el panel'}
        </p>
      </div>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 w-fit items-center rounded-full px-4 text-sm font-medium ring-1 ring-inset ring-slate-300"
        >
          Escribirle por WhatsApp
        </a>
      )}
      {pending && (
        <div className="flex flex-wrap gap-2">
          <Button loading={status.isPending} onClick={() => status.mutate('attended')}>
            Asistió
          </Button>
          <Button variant="secondary" onClick={() => status.mutate('no_show')}>
            No vino
          </Button>
          <Button variant="secondary" onClick={() => setMoving(!moving)}>
            Mover
          </Button>
          <Button variant="ghost" onClick={() => status.mutate('cancelled')}>
            Cancelar turno
          </Button>
        </div>
      )}
      {pending && moving && (
        <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm">
              Día
              <input
                type="date"
                className="h-10 rounded-lg border border-slate-300 px-2"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Hora
              <input
                type="time"
                step={300}
                className="h-10 rounded-lg border border-slate-300 px-2"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Profesional
            <select
              className="h-10 rounded-lg border border-slate-300 bg-white px-2"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              {(staff.data ?? [])
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <Button loading={move.isPending} onClick={() => move.mutate()}>
            Guardar cambio
          </Button>
        </div>
      )}
    </Sheet>
  )
}

function NewAppointmentSheet({ onClose }: { onClose: () => void }) {
  const { business } = usePanel()
  const invalidate = useInvalidateBooking(business.id)
  const services = useServices(business.id)
  const staff = useStaff(business.id)
  const toast = useToast()
  const today = booking.dayInTimeZone(new Date(), business.timezone)
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [day, setDay] = useState(today)
  const [time, setTime] = useState('10:00')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const normalized = normalizePhone(phone)

  const create = useMutation({
    mutationFn: () =>
      booking.bookFromPanel({
        businessId: business.id,
        serviceId,
        staffId: staffId || null,
        startsAt: localToIso(day, time, business.timezone),
        name: name.trim(),
        phone: normalized ?? '',
      }),
    onSuccess: async (status) => {
      if (status !== 'booked') {
        setError(
          status === 'taken'
            ? 'Ese horario no está libre (o está fuera del horario de atención).'
            : 'Revisá los datos.',
        )
        return
      }
      await invalidate()
      toast.show('Turno cargado', 'success')
      onClose()
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    create.mutate()
  }

  return (
    <Sheet title="Nuevo turno" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <label className="flex flex-col gap-1 text-sm">
          Servicio
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Elegí…</option>
            {(services.data ?? [])
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} min)
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Profesional
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">Cualquiera libre</option>
            {(staff.data ?? [])
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Día
            <input
              type="date"
              className="h-10 rounded-lg border border-slate-300 px-2"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hora
            <input
              type="time"
              step={300}
              className="h-10 rounded-lg border border-slate-300 px-2"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>
        <TextField
          label="Nombre del cliente"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Celular"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phone.trim() !== '' && normalized === null ? 'Revisá el celular.' : undefined}
        />
        <Button
          type="submit"
          loading={create.isPending}
          disabled={!serviceId || name.trim().length < 2 || normalized === null}
        >
          Cargar turno
        </Button>
      </form>
    </Sheet>
  )
}

/** Día y hora escritos en la hora del negocio → instante ISO. */
function localToIso(day: string, time: string, timeZone: string): string {
  const guess = new Date(`${day}T${time}:00Z`)
  const shown = booking.minutesOfDay(guess.toISOString(), timeZone)
  const wanted = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  let diff = wanted - shown
  if (diff > 720) diff -= 1440
  if (diff < -720) diff += 1440
  return new Date(guess.getTime() + diff * 60_000).toISOString()
}
