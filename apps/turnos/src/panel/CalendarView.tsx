import { useMemo } from 'react'
import { Calendar, dayjsLocalizer, type EventProps, type SlotInfo } from 'react-big-calendar'
import dragAndDrop, { type EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import './calendar.css'
import type { AgendaItem } from '@plataforma/sdk'
import { staffColor } from './calendarLayout'
import { time24, wallDate } from './calendarTime'

dayjs.locale('es')
const localizer = dayjsLocalizer(dayjs)
// El complemento viene en CommonJS: según el empaquetador llega directo o dentro de `default`.
const withDragAndDrop = ((dragAndDrop as unknown as { default?: typeof dragAndDrop }).default ??
  dragAndDrop) as typeof dragAndDrop
const DnDCalendar = withDragAndDrop<CalendarEvent, StaffResource>(Calendar)

export type CalendarMode = 'day' | 'week'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resourceId: string
  item: AgendaItem
}

interface StaffResource {
  id: string
  title: string
}

const STATUS_LABEL: Record<AgendaItem['status'], string> = {
  booked: 'Pendiente',
  attended: 'Asistió',
  no_show: 'No vino',
  cancelled: 'Cancelado',
}

/**
 * Agenda sobre react-big-calendar: en "día" hay una columna por profesional;
 * los turnos pendientes se arrastran para moverlos y un hueco vacío se toca para
 * cargar un turno.
 */
export function CalendarView({
  mode,
  date,
  items,
  staff,
  staffIds,
  timeZone,
  startHour,
  endHour,
  onSelect,
  onMove,
  onCreate,
}: {
  mode: CalendarMode
  date: Date
  items: AgendaItem[]
  staff: { id: string; name: string }[]
  staffIds: string[]
  timeZone: string
  startHour: number
  endHour: number
  onSelect: (item: AgendaItem) => void
  onMove: (item: AgendaItem, start: Date, staffId: string) => void
  onCreate: (start: Date, staffId: string | null) => void
}) {
  const events = useMemo<CalendarEvent[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.customerName,
        start: wallDate(item.startsAt, timeZone),
        end: wallDate(item.endsAt, timeZone),
        resourceId: item.staffId,
        item,
      })),
    [items, timeZone],
  )
  const resources = useMemo(() => staff.map((s) => ({ id: s.id, title: s.name })), [staff])
  const min = useMemo(() => new Date(1970, 0, 1, startHour), [startHour])
  const max = useMemo(() => new Date(1970, 0, 1, endHour - 1, 59), [endHour])
  // Abre mostrando una hora antes de ahora (o la apertura, si es más tarde).
  const scrollTo = useMemo(() => {
    const now = wallDate(new Date().toISOString(), timeZone)
    return new Date(1970, 0, 1, Math.max(startHour, now.getHours() - 1))
  }, [startHour, timeZone])
  const byStaff = mode === 'day' && resources.length > 1

  function handleDrop({ event, start, resourceId }: EventInteractionArgs<CalendarEvent>) {
    const target = typeof resourceId === 'string' ? resourceId : event.resourceId
    const when = new Date(start)
    if (when.getTime() === event.start.getTime() && target === event.resourceId) return
    onMove(event.item, when, target)
  }

  function handleSlot(slot: SlotInfo) {
    onCreate(slot.start, typeof slot.resourceId === 'string' ? slot.resourceId : null)
  }

  return (
    <div className={`turnos-cal ${mode === 'week' ? 'is-week' : ''}`}>
      <DnDCalendar
        localizer={localizer}
        culture="es"
        events={events}
        view={mode}
        views={['day', 'week']}
        date={date}
        onView={() => undefined}
        onNavigate={() => undefined}
        toolbar={false}
        resources={byStaff ? resources : undefined}
        resourceIdAccessor={(r) => r.id}
        resourceTitleAccessor={(r) => r.title}
        min={min}
        max={max}
        step={15}
        timeslots={4}
        getNow={() => wallDate(new Date().toISOString(), timeZone)}
        scrollToTime={scrollTo}
        dayLayoutAlgorithm="no-overlap"
        selectable
        longPressThreshold={250}
        onSelectSlot={handleSlot}
        onSelectEvent={(event) => onSelect(event.item)}
        onEventDrop={handleDrop}
        draggableAccessor={(event) => event.item.status === 'booked'}
        resizable={false}
        showMultiDayTimes={false}
        formats={{
          timeGutterFormat: 'HH:mm',
          dayFormat: 'ddd D',
          dayHeaderFormat: 'dddd D [de] MMMM',
        }}
        eventPropGetter={(event) => {
          const color = staffColor(staffIds, event.item.staffId)
          const noShow = event.item.status === 'no_show'
          return {
            className: `is-${event.item.status}`,
            style: {
              background: noShow ? '#fef2f2' : color.bg,
              borderLeftColor: noShow ? '#dc2626' : color.bar,
            },
          }
        }}
        components={{
          event: (props: EventProps<CalendarEvent>) => (
            <EventCard {...props} timeZone={timeZone} showStaff={!byStaff} />
          ),
          resourceHeader: ({ resource }: { resource: StaffResource }) => (
            <span className="flex items-center justify-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: staffColor(staffIds, resource.id).bar }}
              />
              {resource.title}
            </span>
          ),
        }}
        messages={{ noEventsInRange: 'Sin turnos', showMore: (n) => `+${n} más` }}
      />
    </div>
  )
}

function EventCard({
  event,
  timeZone,
  showStaff,
}: EventProps<CalendarEvent> & { timeZone: string; showStaff: boolean }) {
  const { item } = event
  const detail = showStaff ? `${item.serviceName} · ${item.staffName}` : item.serviceName
  return (
    <span
      className="flex h-full min-w-0 flex-col"
      title={`${time24(item.startsAt, timeZone)} ${item.customerName} — ${item.serviceName} con ${item.staffName} (${STATUS_LABEL[item.status]})`}
    >
      <span className="flex min-w-0 items-baseline gap-1">
        <span className="ev-time shrink-0 tabular-nums">{time24(item.startsAt, timeZone)}</span>
        <span className="ev-name truncate">{item.customerName}</span>
        {item.status === 'attended' && <span aria-label="Asistió">✓</span>}
      </span>
      <span className="ev-detail truncate">{detail}</span>
    </span>
  )
}
