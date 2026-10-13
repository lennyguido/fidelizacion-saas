import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import {
  booking,
  errorMessage,
  type BookingSettings,
  type HoursRange,
  type StaffMember,
} from '@plataforma/sdk'
import { Alert, Button, Card, EmptyState, Spinner, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import {
  useBookingSettings,
  useHours,
  useInvalidateBooking,
  useServices,
  useStaff,
} from './queries'

const DEFAULT_SETTINGS: BookingSettings = {
  enabled: false,
  slotMinutes: 15,
  minNoticeMinutes: 60,
  maxDaysAhead: 30,
  cancelNoticeMinutes: 120,
  message: null,
}

/** Turnos → Configurar: servicios, profesionales, horarios y reservas online (dueño/admin). */
export function BookingSetupPage() {
  const { business } = useActiveBusiness()
  if (business.role === 'staff') {
    return <EmptyState title="Solo el dueño o un administrador puede configurar los turnos" />
  }
  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <Link to={`/b/${business.slug}/turnos`} className="text-sm underline">
        ← Volver a la agenda
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Configurar turnos</h1>
      <ServicesCard />
      <StaffCard />
      <SettingsCard />
    </section>
  )
}

function SettingsCard() {
  const { business } = useActiveBusiness()
  const settings = useBookingSettings(business.id)
  const services = useServices(business.id)
  const hours = useHours(business.id)
  const invalidate = useInvalidateBooking(business.id)
  const toast = useToast()
  const [draft, setDraft] = useState<BookingSettings | null>(null)
  const current = draft ?? settings.data ?? DEFAULT_SETTINGS
  const ready = (services.data ?? []).some((s) => s.active) && (hours.data ?? []).length > 0

  const save = useMutation({
    mutationFn: (value: BookingSettings) => booking.saveSettings(business.id, value),
    onSuccess: async () => {
      setDraft(null)
      await invalidate()
      toast.show('Guardado', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  if (settings.isPending) return <Spinner />
  const set = (patch: Partial<BookingSettings>) => setDraft({ ...current, ...patch })

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Reservas online</h2>
      {!ready && (
        <Alert tone="info">Para prenderlas, cargá al menos un servicio y los horarios de alguien.</Alert>
      )}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={current.enabled}
          disabled={!ready && !current.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        Tomar turnos online en {booking.publicBookingUrl(business.slug)}
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberSelect
          label="Anticipación mínima"
          value={current.minNoticeMinutes}
          options={[
            [0, 'Sin mínimo'],
            [60, '1 hora'],
            [120, '2 horas'],
            [1440, '1 día'],
          ]}
          onChange={(v) => set({ minNoticeMinutes: v })}
        />
        <NumberSelect
          label="Se puede reservar hasta"
          value={current.maxDaysAhead}
          options={[
            [7, '1 semana antes'],
            [14, '2 semanas antes'],
            [30, '1 mes antes'],
            [60, '2 meses antes'],
          ]}
          onChange={(v) => set({ maxDaysAhead: v })}
        />
        <NumberSelect
          label="Cancelar online hasta"
          value={current.cancelNoticeMinutes}
          options={[
            [0, 'Último momento'],
            [120, '2 horas antes'],
            [720, '12 horas antes'],
            [1440, '1 día antes'],
          ]}
          onChange={(v) => set({ cancelNoticeMinutes: v })}
        />
      </div>
      <TextField
        label="Mensaje para tus clientes (opcional)"
        maxLength={300}
        value={current.message ?? ''}
        placeholder="Ej.: Si llegás 10 minutos tarde, perdés el turno."
        onChange={(e) => set({ message: e.target.value || null })}
      />
      <Button
        className="w-fit"
        loading={save.isPending}
        disabled={draft === null}
        onClick={() => save.mutate(current)}
      >
        Guardar
      </Button>
    </Card>
  )
}

function NumberSelect(props: {
  label: string
  value: number
  options: [number, string][]
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-slate-800">{props.label}</span>
      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3"
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ServicesCard() {
  const { business } = useActiveBusiness()
  const services = useServices(business.id)
  const invalidate = useInvalidateBooking(business.id)
  const toast = useToast()
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('')

  const save = useMutation({
    mutationFn: (input: Parameters<typeof booking.saveService>[1]) =>
      booking.saveService(business.id, input),
    onSuccess: async () => {
      setName('')
      setPrice('')
      await invalidate()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const pesos = price.trim() === '' ? null : Number(price.replace(/\./g, '').replace(',', '.'))
    save.mutate({
      name: name.trim(),
      durationMinutes: Number(duration),
      priceMinor: pesos === null || Number.isNaN(pesos) ? null : Math.round(pesos * 100),
      active: true,
    })
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Servicios</h2>
      {services.isPending && <Spinner />}
      <ul className="divide-y divide-slate-100">
        {services.data?.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className={s.active ? '' : 'text-slate-400 line-through'}>
              {s.name} · {s.durationMinutes} min
              {s.priceMinor !== null && ` · $${(s.priceMinor / 100).toLocaleString('es-AR')}`}
            </span>
            <Button variant="ghost" onClick={() => save.mutate({ ...s, active: !s.active })}>
              {s.active ? 'Ocultar' : 'Mostrar'}
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <TextField label="Servicio" placeholder="Corte" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">Dura</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-3"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            {[15, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Precio (opcional)"
          inputMode="decimal"
          placeholder="8000"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Button type="submit" loading={save.isPending} disabled={name.trim() === ''}>
          Agregar
        </Button>
      </form>
    </Card>
  )
}

function StaffCard() {
  const { business } = useActiveBusiness()
  const staff = useStaff(business.id)
  const hours = useHours(business.id)
  const invalidate = useInvalidateBooking(business.id)
  const toast = useToast()
  const [name, setName] = useState('')

  const add = useMutation({
    mutationFn: () => booking.saveStaff(business.id, { name: name.trim(), active: true }),
    onSuccess: async () => {
      setName('')
      await invalidate()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Profesionales y horarios</h2>
        <p className="text-sm text-slate-600">
          Quién atiende y en qué horarios. Si trabajás solo, cargate a vos.
        </p>
      </div>
      {staff.isPending && <Spinner />}
      {staff.data?.map((member) => (
        <StaffHours
          key={member.id}
          member={member}
          ranges={(hours.data ?? []).filter((h) => h.staffId === member.id)}
        />
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          add.mutate()
        }}
        className="flex items-end gap-3"
      >
        <TextField
          label="Nuevo profesional"
          placeholder="Juan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" loading={add.isPending} disabled={name.trim() === ''}>
          Agregar
        </Button>
      </form>
    </Card>
  )
}

type DayDraft = { on: boolean; start: string; end: string }

function StaffHours({ member, ranges }: { member: StaffMember; ranges: HoursRange[] }) {
  const { business } = useActiveBusiness()
  const invalidate = useInvalidateBooking(business.id)
  const toast = useToast()
  const initial: DayDraft[] = booking.WEEKDAYS.map((_, weekday) => {
    const range = ranges.find((r) => r.weekday === weekday)
    return range
      ? { on: true, start: range.startTime, end: range.endTime }
      : { on: false, start: '09:00', end: '18:00' }
  })
  const [days, setDays] = useState<DayDraft[] | null>(null)
  const current = days ?? initial

  const save = useMutation({
    mutationFn: () =>
      booking.replaceHours(
        business.id,
        member.id,
        current.flatMap((d, weekday) =>
          d.on && d.end > d.start ? [{ weekday, startTime: d.start, endTime: d.end }] : [],
        ),
      ),
    onSuccess: async () => {
      setDays(null)
      await invalidate()
      toast.show(`Horarios de ${member.name} guardados`, 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  const setDay = (index: number, patch: Partial<DayDraft>) =>
    setDays(current.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
      <p className="font-medium">{member.name}</p>
      {current.map((d, weekday) => (
        <div key={weekday} className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex w-28 items-center gap-2">
            <input type="checkbox" checked={d.on} onChange={(e) => setDay(weekday, { on: e.target.checked })} />
            {booking.WEEKDAYS[weekday]}
          </label>
          {d.on && (
            <>
              <input
                type="time"
                aria-label={`${booking.WEEKDAYS[weekday]} desde`}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2"
                value={d.start}
                onChange={(e) => setDay(weekday, { start: e.target.value })}
              />
              a
              <input
                type="time"
                aria-label={`${booking.WEEKDAYS[weekday]} hasta`}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2"
                value={d.end}
                onChange={(e) => setDay(weekday, { end: e.target.value })}
              />
            </>
          )}
        </div>
      ))}
      <Button className="w-fit" loading={save.isPending} disabled={days === null} onClick={() => save.mutate()}>
        Guardar horarios
      </Button>
    </div>
  )
}
