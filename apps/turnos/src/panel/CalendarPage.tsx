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
import { CalendarView, type CalendarMode } from './CalendarView'
import { staffColor } from './calendarLayout'
import { localToIso, time24, wallParts, wallToIso } from './calendarTime'

const STATUS_LABEL: Record<AgendaItem['status'], string> = {
  booked: 'Pendiente',
  attended: 'Asistió',
  no_show: 'No vino',
  cancelled: 'Cancelado',
}

/** Agenda (D-050): el día por profesional y la semana completa. */
export function CalendarPage() {
  const { business } = usePanel()
  const tz = business.timezone
  const today = booking.dayInTimeZone(new Date(), tz)
  const [mode, setMode] = useState<CalendarMode>('day')
  const [focus, setFocus] = useState(today)
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [creating, setCreating] = useState<NewSlot | null | false>(false)
  const invalidate = useInvalidateBooking(business.id)
  const toast = useToast()
  const from = booking.weekStart(focus)
  const week = useWeek(business.id, from)
  const staff = useStaff(business.id)
  const hours = useHours(business.id)

  const move = useMutation({
    mutationFn: (args: { item: AgendaItem; start: Date; staffId: string }) =>
      booking.moveAppointment(args.item.id, args.staffId, wallToIso(args.start, tz)),
    onSuccess: async (result, { item, start }) => {
      if (result === 'taken') {
        toast.show('Ese horario no está libre', 'error')
        return
      }
      await invalidate()
      toast.show(
        `${item.customerName.split(' ')[0]} pasó a las ${wallParts(start).time}`,
        'success',
      )
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  /** Mientras se guarda, el turno arrastrado ya se ve en su lugar nuevo. */
  function moved(a: AgendaItem): AgendaItem {
    const { start, staffId } = move.variables!
    const startsAt = wallToIso(start, tz)
    const length = new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()
    const endsAt = new Date(new Date(startsAt).getTime() + length).toISOString()
    return { ...a, startsAt, endsAt, staffId }
  }

  const activeStaff = (staff.data ?? []).filter((s) => s.active)
  const staffIds = (staff.data ?? []).map((s) => s.id)
  const shownStaff = activeStaff.filter((s) => staffFilter === 'all' || s.id === staffFilter)
  const items = (week.data ?? [])
    .map((a) => (move.isPending && move.variables?.item.id === a.id ? moved(a) : a))
    .filter((a) => a.status !== 'cancelled' && (staffFilter === 'all' || a.staffId === staffFilter))
  const visible = items.filter((a) => {
    const day = booking.dayInTimeZone(new Date(a.startsAt), tz)
    return mode === 'week' || day === focus
  })
  const pending = visible.filter((a) => a.status === 'booked').length
  const ranges = hours.data ?? []
  const startHour = Math.min(8, ...ranges.map((r) => Number(r.startTime.slice(0, 2))))
  const endHour = Math.max(20, ...ranges.map((r) => Math.ceil(Number(r.endTime.slice(0, 2)))))
  const [y, m, d] = focus.split('-').map(Number)
  const step = mode === 'day' ? 1 : 7
  const title =
    mode === 'day'
      ? focus === today
        ? `Hoy, ${booking.formatDay(focus)}`
        : booking.formatDay(focus)
      : `${booking.formatDay(from)} – ${booking.formatDay(booking.addDays(from, 6))}`

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => setFocus(booking.addDays(focus, -step))}
            aria-label={mode === 'day' ? 'Día anterior' : 'Semana anterior'}
          >
            ←
          </Button>
          <Button
            variant="secondary"
            onClick={() => setFocus(booking.addDays(focus, step))}
            aria-label={mode === 'day' ? 'Día siguiente' : 'Semana siguiente'}
          >
            →
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setFocus(today)} disabled={focus === today}>
          Hoy
        </Button>
        <p className="font-semibold capitalize">{title}</p>
        <span className="text-sm text-slate-500">
          {pending} {pending === 1 ? 'pendiente' : 'pendientes'}
        </span>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <div
            role="radiogroup"
            aria-label="Vista"
            className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium"
          >
            {(['day', 'week'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={mode === v}
                onClick={() => setMode(v)}
                className={`h-8 rounded-md px-3 ${
                  mode === v ? 'bg-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {v === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
          <select
            aria-label="Profesional"
            className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm sm:flex-none"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setCreating(null)}>Nuevo turno</Button>
        </div>
      </div>

      {mode === 'week' && staffIds.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600" aria-label="Colores">
          {activeStaff.map((s) => (
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
          className={
            mode === 'week' ? 'min-w-[840px]' : shownStaff.length > 2 ? 'min-w-[560px]' : ''
          }
        >
          <CalendarView
            mode={mode}
            date={new Date(y!, m! - 1, d!)}
            items={items}
            staff={shownStaff}
            staffIds={staffIds}
            timeZone={tz}
            startHour={startHour}
            endHour={endHour}
            onSelect={setSelected}
            onMove={(item, start, staffId) => move.mutate({ item, start, staffId })}
            onCreate={(start, staffId) =>
              setCreating({ ...wallParts(start), staffId: staffId ?? '' })
            }
          />
        </div>
      </div>
      <p className="text-sm text-slate-500">
        Tocá un hueco para cargar un turno. Arrastrá un turno pendiente para moverlo.
      </p>

      {selected && <AppointmentSheet item={selected} onClose={() => setSelected(null)} />}
      {creating !== false && (
        <NewAppointmentSheet initial={creating} onClose={() => setCreating(false)} />
      )}
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
  const [time, setTime] = useState(time24(item.startsAt, business.timezone))
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
        )} a las ${time24(item.startsAt, business.timezone)}.`,
      )}`
    : null

  return (
    <Sheet title={item.customerName} onClose={onClose}>
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-base font-medium capitalize">
          {booking.formatDay(booking.dayInTimeZone(new Date(item.startsAt), business.timezone))} ·{' '}
          {time24(item.startsAt, business.timezone)}
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

interface NewSlot {
  day: string
  time: string
  staffId: string
}

function NewAppointmentSheet({
  initial,
  onClose,
}: {
  initial: NewSlot | null
  onClose: () => void
}) {
  const { business } = usePanel()
  const invalidate = useInvalidateBooking(business.id)
  const services = useServices(business.id)
  const staff = useStaff(business.id)
  const toast = useToast()
  const today = booking.dayInTimeZone(new Date(), business.timezone)
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState(initial?.staffId ?? '')
  const [day, setDay] = useState(initial?.day ?? today)
  const [time, setTime] = useState(initial?.time ?? '10:00')
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
