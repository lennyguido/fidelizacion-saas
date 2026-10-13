import { useState, type FormEvent } from 'react'
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

const HOUR_PX = 56
const STATUS_STYLE: Record<AgendaItem['status'], string> = {
  booked: 'bg-action/10 ring-action text-slate-900',
  attended: 'bg-emerald-50 ring-emerald-400 text-emerald-900',
  no_show: 'bg-red-50 ring-red-300 text-red-900 line-through',
  cancelled: 'bg-slate-100 ring-slate-300 text-slate-500 line-through',
}
const STATUS_LABEL: Record<AgendaItem['status'], string> = {
  booked: 'Pendiente',
  attended: 'Asistió',
  no_show: 'No vino',
  cancelled: 'Cancelado',
}

/** Calendario semanal por profesional (D-050). */
export function CalendarPage() {
  const { business } = usePanel()
  const today = booking.dayInTimeZone(new Date(), business.timezone)
  const [from, setFrom] = useState(booking.weekStart(today))
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [creating, setCreating] = useState(false)
  const week = useWeek(business.id, from)
  const staff = useStaff(business.id)
  const hours = useHours(business.id)

  const days = Array.from({ length: 7 }, (_, i) => booking.addDays(from, i))
  const items = (week.data ?? []).filter(
    (a) => a.status !== 'cancelled' && (staffFilter === 'all' || a.staffId === staffFilter),
  )
  const ranges = hours.data ?? []
  const startHour = Math.min(8, ...ranges.map((r) => Number(r.startTime.slice(0, 2))))
  const endHour = Math.max(20, ...ranges.map((r) => Math.ceil(Number(r.endTime.slice(0, 2)))))
  const pending = items.filter((a) => a.status === 'booked').length

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => setFrom(booking.addDays(from, -7))}
          aria-label="Semana anterior"
        >
          ←
        </Button>
        <Button
          variant="secondary"
          onClick={() => setFrom(booking.addDays(from, 7))}
          aria-label="Semana siguiente"
        >
          →
        </Button>
        <Button variant="ghost" onClick={() => setFrom(booking.weekStart(today))}>
          Hoy
        </Button>
        <p className="font-semibold capitalize">
          {booking.formatDay(days[0]!)} – {booking.formatDay(days[6]!)}
        </p>
        <span className="text-sm text-slate-500">{pending} pendientes</span>
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Profesional"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
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

      {week.isPending && <Spinner />}
      {week.error && <Alert tone="error">{errorMessage(week.error)}</Alert>}

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="grid min-w-[840px]" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div />
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
          <div className="relative" style={{ height: (endHour - startHour) * HOUR_PX }}>
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <span
                key={i}
                className="absolute right-2 text-xs text-slate-400"
                style={{ top: i * HOUR_PX - 6 }}
              >
                {String(startHour + i).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              className="relative border-l border-slate-100"
              style={{ height: (endHour - startHour) * HOUR_PX }}
            >
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0 border-t border-slate-100"
                  style={{ top: i * HOUR_PX }}
                />
              ))}
              {items
                .filter((a) => booking.dayInTimeZone(new Date(a.startsAt), business.timezone) === d)
                .map((a) => {
                  const top =
                    ((booking.minutesOfDay(a.startsAt, business.timezone) - startHour * 60) / 60) *
                    HOUR_PX
                  const height = Math.max(
                    22,
                    ((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 3_600_000) *
                      HOUR_PX -
                      2,
                  )
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelected(a)}
                      className={`absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left text-xs ring-1 ring-inset ${STATUS_STYLE[a.status]}`}
                      style={{ top, height }}
                    >
                      <span className="font-semibold">
                        {booking.formatTime(a.startsAt, business.timezone)} {a.customerName}
                      </span>
                      <span className="block truncate">
                        {a.serviceName} · {a.staffName}
                      </span>
                    </button>
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
