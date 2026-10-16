import { booking } from '@plataforma/sdk'

/**
 * El calendario trabaja con fechas "de reloj de pared": un turno de las 10:00 en la
 * hora del negocio se dibuja a las 10:00 aunque la compu esté en otra zona horaria.
 */
export function wallDate(iso: string, timeZone: string): Date {
  const [y, m, d] = booking.dayInTimeZone(new Date(iso), timeZone).split('-').map(Number)
  const minutes = booking.minutesOfDay(iso, timeZone)
  return new Date(y!, m! - 1, d!, Math.floor(minutes / 60), minutes % 60)
}

/** Fecha de reloj de pared → día `YYYY-MM-DD` y hora `HH:MM`. */
export function wallParts(date: Date): { day: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

/** Fecha de reloj de pared → instante ISO en la hora del negocio. */
export function wallToIso(date: Date, timeZone: string): string {
  const { day, time } = wallParts(date)
  return localToIso(day, time, timeZone)
}

/** Día y hora escritos en la hora del negocio → instante ISO. */
export function localToIso(day: string, time: string, timeZone: string): string {
  const guess = new Date(`${day}T${time}:00Z`)
  const shown = booking.minutesOfDay(guess.toISOString(), timeZone)
  const wanted = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  let diff = wanted - shown
  if (diff > 720) diff -= 1440
  if (diff < -720) diff += 1440
  return new Date(guess.getTime() + diff * 60_000).toISOString()
}

/** Hora en formato 24 h ("09:30"), más corta que "09:30 a. m.". */
export function time24(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}
