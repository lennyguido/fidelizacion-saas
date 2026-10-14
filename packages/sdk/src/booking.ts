// Turnos online (D-049, módulo `booking`). La página pública vive en turnos.neriva.net
// y no necesita cuenta; el panel usa las funciones de agenda y estado.
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

function db() {
  return getSupabase().schema('booking')
}

// Público ------------------------------------------------------------------------------

export interface PublicService {
  id: string
  name: string
  durationMinutes: number
  priceMinor: number | null
}

export interface PublicPage {
  name: string
  logoPath: string | null
  color: string | null
  timezone: string
  message: string | null
  maxDaysAhead: number
  services: PublicService[]
  staff: { id: string; name: string }[]
}

export interface Slot {
  startsAt: string
  staffId: string
}

export type BookStatus =
  | 'booked'
  | 'taken'
  | 'invalid_name'
  | 'invalid_phone'
  | 'terms_required'
  | 'rate_limited'
  | 'unavailable'

export interface AppointmentView {
  serviceId: string
  staffId: string
  status: 'booked' | 'cancelled' | 'attended' | 'no_show'
  startsAt: string
  endsAt: string
  serviceName: string
  staffName: string
  businessName: string
  businessSlug: string
  timezone: string
  priceMinor: number | null
  canCancel: boolean
  cancelNoticeMinutes: number
  /** Color y logo del negocio, y su mensaje (por ejemplo, la dirección). */
  color?: string | null
  logoPath?: string | null
  message?: string | null
}

export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  const { data, error } = await db().rpc('get_public_page', { p_slug: slug })
  if (error) throw fromPostgrestError(error)
  return (data as PublicPage | null) ?? null
}

/** `day` en formato AAAA-MM-DD (día del negocio). `staffId` null = cualquiera. */
export async function availableSlots(
  slug: string,
  serviceId: string,
  staffId: string | null,
  day: string,
): Promise<Slot[]> {
  const { data, error } = await db().rpc('available_slots', {
    p_slug: slug,
    p_service_id: serviceId,
    p_staff_id: staffId as string,
    p_day: day,
  })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({ startsAt: row.starts_at, staffId: row.staff_id }))
}

export async function book(input: {
  slug: string
  serviceId: string
  staffId: string | null
  startsAt: string
  name: string
  phone: string
  termsAccepted: boolean
  /** Acepta recibir promociones del negocio por WhatsApp (D-053). */
  promos?: boolean
}): Promise<{ status: BookStatus; token?: string }> {
  const { data, error } = await db().rpc('book', {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_staff_id: input.staffId as string,
    p_starts_at: input.startsAt,
    p_name: input.name,
    p_phone: input.phone,
    p_terms_accepted: input.termsAccepted,
    p_promos: input.promos ?? false,
  })
  if (error) throw fromPostgrestError(error)
  const result = (data ?? {}) as { status?: BookStatus; token?: string }
  return { status: result.status ?? 'unavailable', token: result.token }
}

export async function getAppointment(token: string): Promise<AppointmentView | null> {
  const { data, error } = await db().rpc('get_appointment', { p_token: token })
  if (error) throw fromPostgrestError(error)
  return (data as AppointmentView | null) ?? null
}

export type CancelResult = 'cancelled' | 'too_late' | 'not_booked' | 'not_found'

export async function cancelByCustomer(token: string): Promise<CancelResult> {
  const { data, error } = await db().rpc('cancel_by_customer', { p_token: token })
  if (error) throw fromPostgrestError(error)
  return data as CancelResult
}

/** Link del turno: el código va después de #, así no queda en los registros de ningún servidor. */
export function appointmentPath(token: string): string {
  return `/turno#${token}`
}

export function tokenFromHash(hash: string): string | null {
  const token = hash.replace(/^#/, '')
  return /^[0-9a-f]{64}$/.test(token) ? token : null
}

// Fechas en la zona horaria del negocio ----------------------------------------------

/** AAAA-MM-DD de un instante, en la zona horaria dada. */
export function dayInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Los próximos `count` días (AAAA-MM-DD) desde hoy, en la zona del negocio. */
export function nextDays(timeZone: string, count: number, from: Date = new Date()): string[] {
  const days: string[] = []
  for (let i = 0; days.length < count && i < count + 2; i++) {
    const day = dayInTimeZone(new Date(from.getTime() + i * 86_400_000), timeZone)
    if (!days.includes(day)) days.push(day)
  }
  return days
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(Date.UTC(y!, m! - 1, d!)))
}

// Panel --------------------------------------------------------------------------------

export interface AgendaItem {
  id: string
  startsAt: string
  endsAt: string
  status: AppointmentView['status']
  source: 'online' | 'panel'
  staffId: string
  staffName: string
  serviceName: string
  priceMinor: number | null
  customerId: string
  customerName: string
  customerPhone: string | null
}

export async function agenda(businessId: string, from: string, to: string): Promise<AgendaItem[]> {
  const { data, error } = await db().rpc('agenda', {
    p_business_id: businessId,
    p_from: from,
    p_to: to,
  })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as AgendaItem['status'],
    source: row.source as AgendaItem['source'],
    staffId: row.staff_id,
    staffName: row.staff_name,
    serviceName: row.service_name,
    priceMinor: row.price_minor,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
  }))
}

export async function setStatus(
  appointmentId: string,
  status: 'attended' | 'no_show' | 'cancelled',
): Promise<void> {
  const { error } = await db().rpc('set_status', {
    p_appointment_id: appointmentId,
    p_status: status,
  })
  if (error) throw fromPostgrestError(error)
}

export async function bookFromPanel(input: {
  businessId: string
  serviceId: string
  staffId: string | null
  startsAt: string
  name: string
  phone: string
}): Promise<BookStatus> {
  const { data, error } = await db().rpc('book_from_panel', {
    p_business_id: input.businessId,
    p_service_id: input.serviceId,
    p_staff_id: input.staffId as string,
    p_starts_at: input.startsAt,
    p_name: input.name,
    p_phone: input.phone,
  })
  if (error) throw fromPostgrestError(error)
  return ((data as { status?: BookStatus } | null)?.status ?? 'unavailable') as BookStatus
}

// Configuración (dueño/admin) ----------------------------------------------------------

export interface BookingSettings {
  enabled: boolean
  slotMinutes: number
  minNoticeMinutes: number
  maxDaysAhead: number
  cancelNoticeMinutes: number
  message: string | null
}

export interface Service {
  id: string
  name: string
  durationMinutes: number
  priceMinor: number | null
  active: boolean
}

export interface StaffMember {
  id: string
  name: string
  active: boolean
}

export interface HoursRange {
  id: string
  staffId: string
  weekday: number
  startTime: string
  endTime: string
}

export async function getSettings(businessId: string): Promise<BookingSettings | null> {
  const { data, error } = await db()
    .from('settings')
    .select(
      'enabled, slot_minutes, min_notice_minutes, max_days_ahead, cancel_notice_minutes, message',
    )
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw fromPostgrestError(error)
  if (!data) return null
  return {
    enabled: data.enabled,
    slotMinutes: data.slot_minutes,
    minNoticeMinutes: data.min_notice_minutes,
    maxDaysAhead: data.max_days_ahead,
    cancelNoticeMinutes: data.cancel_notice_minutes,
    message: data.message,
  }
}

export async function saveSettings(businessId: string, settings: BookingSettings): Promise<void> {
  const { error } = await db().from('settings').upsert({
    business_id: businessId,
    enabled: settings.enabled,
    slot_minutes: settings.slotMinutes,
    min_notice_minutes: settings.minNoticeMinutes,
    max_days_ahead: settings.maxDaysAhead,
    cancel_notice_minutes: settings.cancelNoticeMinutes,
    message: settings.message,
    updated_at: new Date().toISOString(),
  })
  if (error) throw fromPostgrestError(error)
}

export async function listServices(businessId: string): Promise<Service[]> {
  const { data, error } = await db()
    .from('services')
    .select('id, name, duration_minutes, price_minor, active')
    .eq('business_id', businessId)
    .order('sort')
    .order('name')
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    priceMinor: row.price_minor,
    active: row.active,
  }))
}

export async function saveService(
  businessId: string,
  service: Omit<Service, 'id'> & { id?: string },
): Promise<void> {
  const row = {
    business_id: businessId,
    name: service.name,
    duration_minutes: service.durationMinutes,
    price_minor: service.priceMinor,
    active: service.active,
  }
  const { error } = service.id
    ? await db().from('services').update(row).eq('id', service.id)
    : await db().from('services').insert(row)
  if (error) throw fromPostgrestError(error)
}

export async function listStaff(businessId: string): Promise<StaffMember[]> {
  const { data, error } = await db()
    .from('staff')
    .select('id, name, active')
    .eq('business_id', businessId)
    .order('sort')
    .order('name')
  if (error) throw fromPostgrestError(error)
  return data ?? []
}

export async function saveStaff(
  businessId: string,
  member: Omit<StaffMember, 'id'> & { id?: string },
): Promise<string> {
  const row = { business_id: businessId, name: member.name, active: member.active }
  const { data, error } = member.id
    ? await db().from('staff').update(row).eq('id', member.id).select('id').single()
    : await db().from('staff').insert(row).select('id').single()
  if (error) throw fromPostgrestError(error)
  return data.id
}

export async function listHours(businessId: string): Promise<HoursRange[]> {
  const { data, error } = await db()
    .from('hours')
    .select('id, staff_id, weekday, start_time, end_time')
    .eq('business_id', businessId)
    .order('weekday')
    .order('start_time')
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    weekday: row.weekday,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
  }))
}

/** Reemplaza todas las franjas de un profesional. */
export async function replaceHours(
  businessId: string,
  staffId: string,
  ranges: { weekday: number; startTime: string; endTime: string }[],
): Promise<void> {
  const del = await db()
    .from('hours')
    .delete()
    .eq('business_id', businessId)
    .eq('staff_id', staffId)
  if (del.error) throw fromPostgrestError(del.error)
  if (ranges.length === 0) return
  const { error } = await db()
    .from('hours')
    .insert(
      ranges.map((r) => ({
        business_id: businessId,
        staff_id: staffId,
        weekday: r.weekday,
        start_time: r.startTime,
        end_time: r.endTime,
      })),
    )
  if (error) throw fromPostgrestError(error)
}

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** Link público de reservas del negocio. */
export const BOOKING_BASE_URL = 'https://turnos.neriva.net'
export function publicBookingUrl(slug: string): string {
  return `${BOOKING_BASE_URL}/${slug}`
}

// Reprogramar, mover y clientes (D-050) -------------------------------------------------

export type RescheduleResult =
  | 'rescheduled'
  | 'taken'
  | 'too_late'
  | 'not_booked'
  | 'not_found'
  | 'unavailable'

export async function reschedule(token: string, startsAt: string): Promise<RescheduleResult> {
  const { data, error } = await db().rpc('reschedule', { p_token: token, p_starts_at: startsAt })
  if (error) throw fromPostgrestError(error)
  return data as RescheduleResult
}

export async function moveAppointment(
  appointmentId: string,
  staffId: string,
  startsAt: string,
): Promise<'moved' | 'taken'> {
  const { data, error } = await db().rpc('move_appointment', {
    p_appointment_id: appointmentId,
    p_staff_id: staffId,
    p_starts_at: startsAt,
  })
  if (error) throw fromPostgrestError(error)
  return data as 'moved' | 'taken'
}

export interface BookingClient {
  customerId: string
  name: string
  phone: string | null
  bookings: number
  attended: number
  noShows: number
  spentMinor: number
  lastAt: string | null
  nextAt: string | null
}

export async function clients(businessId: string, search: string): Promise<BookingClient[]> {
  const { data, error } = await db().rpc('clients', {
    p_business_id: businessId,
    p_search: search,
  })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    bookings: Number(row.bookings),
    attended: Number(row.attended),
    noShows: Number(row.no_shows),
    spentMinor: Number(row.spent_minor),
    lastAt: row.last_at,
    nextAt: row.next_at,
  }))
}

export interface ClientVisit {
  id: string
  startsAt: string
  status: AppointmentView['status']
  serviceName: string
  staffName: string
  priceMinor: number | null
}

export async function clientHistory(
  businessId: string,
  customerId: string,
): Promise<ClientVisit[]> {
  const { data, error } = await db().rpc('client_history', {
    p_business_id: businessId,
    p_customer_id: customerId,
  })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    status: row.status as ClientVisit['status'],
    serviceName: row.service_name,
    staffName: row.staff_name,
    priceMinor: row.price_minor,
  }))
}

/** Suma días a una fecha AAAA-MM-DD. */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + delta)).toISOString().slice(0, 10)
}

/** Lunes de la semana de esa fecha (AAAA-MM-DD). */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()
  return addDays(day, -((dow + 6) % 7))
}

/** Minutos desde la medianoche (hora del negocio) de un instante. */
export function minutesOfDay(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

// Calendario del celular (D-051) --------------------------------------------------------

/**
 * Link secreto del calendario de un profesional (dueño o admin). Se crea la primera vez;
 * con `rotate` se cambia y el link viejo deja de funcionar.
 */
export async function calendarToken(staffId: string, rotate = false): Promise<string> {
  const { data, error } = await db().rpc('calendar_token', {
    p_staff_id: staffId,
    p_rotate: rotate,
  })
  if (error) throw fromPostgrestError(error)
  return data as string
}

/** Dirección del calendario para Google/Outlook (https) y para iPhone (webcal). */
export function calendarFeedUrls(token: string): { https: string; webcal: string } {
  const https = `${BOOKING_BASE_URL}/cal/${token}.ics`
  return { https, webcal: https.replace(/^https:/, 'webcal:') }
}

// Llenar huecos (D-053) -----------------------------------------------------------------

export interface GapSlot {
  startsAt: string
  staffId: string
  staffName: string
  serviceName: string
}

/** Horarios libres de un día (miembros del negocio). */
export async function gapSlots(businessId: string, day: string): Promise<GapSlot[]> {
  const { data, error } = await db().rpc('gap_slots', { p_business_id: businessId, p_day: day })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((r) => ({
    startsAt: r.starts_at,
    staffId: r.staff_id,
    staffName: r.staff_name,
    serviceName: r.service_name,
  }))
}

export interface LapsedClient {
  customerId: string
  name: string
  phone: string
  lastAt: string
  visits: number
  daysAway: number
  lastService: string | null
}

/** Clientes que no vienen hace `minDays` días y aceptaron promociones por WhatsApp. */
export async function lapsedClients(businessId: string, minDays: number): Promise<LapsedClient[]> {
  const { data, error } = await db().rpc('lapsed_clients', {
    p_business_id: businessId,
    p_min_days: minDays,
  })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((r) => ({
    customerId: r.customer_id,
    name: r.name,
    phone: r.phone,
    lastAt: r.last_at,
    visits: Number(r.visits),
    daysAway: r.days_away,
    lastService: r.last_service,
  }))
}

/** Texto de la oferta para mandar por WhatsApp (el dueño lo puede editar antes). */
export function gapOfferMessage(input: {
  clientName: string
  businessName: string
  day: string
  time: string
  discountPercent: number
  bookingUrl: string
}): string {
  const first = input.clientName.trim().split(/\s+/)[0] ?? ''
  const offer = input.discountPercent > 0 ? ` con ${input.discountPercent}% de descuento` : ''
  return (
    `¡Hola ${first}! Hace rato no te vemos por ${input.businessName}. ` +
    `Nos quedó un lugar ${input.day} a las ${input.time}${offer}. ` +
    `Si lo querés, reservalo acá: ${input.bookingUrl}`
  )
}

/** Link de WhatsApp con el texto listo para enviar. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

// Guardar el turno: mail, WhatsApp y calendario (D-055) ---------------------------------

export type SendByEmailResult = 'queued' | 'invalid_email' | 'not_found' | 'limit'

/** El cliente pide su turno por mail (queda en la bandeja de mails del núcleo). */
export async function sendByEmail(token: string, email: string): Promise<SendByEmailResult> {
  const { data, error } = await db().rpc('send_by_email', { p_token: token, p_email: email })
  if (error) throw fromPostgrestError(error)
  return data as SendByEmailResult
}

function icsStamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function icsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Archivo .ics del turno para el calendario del cliente, con aviso 1 hora antes. */
export function appointmentIcs(view: AppointmentView, link: string, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neriva//Turnos//ES',
    'BEGIN:VEVENT',
    `UID:${icsStamp(view.startsAt)}-${view.serviceId}@turnos.neriva.net`,
    `DTSTAMP:${icsStamp(now.toISOString())}`,
    `DTSTART:${icsStamp(view.startsAt)}`,
    `DTEND:${icsStamp(view.endsAt)}`,
    `SUMMARY:${icsText(`${view.serviceName} en ${view.businessName}`)}`,
    `DESCRIPTION:${icsText(`Con ${view.staffName}.\nPara cambiarlo o cancelarlo: ${link}`)}`,
    `URL:${link}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Tenés turno en una hora',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
