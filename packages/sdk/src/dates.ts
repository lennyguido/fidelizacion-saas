/**
 * Inicio del día (00:00) en la zona horaria del negocio, como instante UTC en ISO.
 * Ej.: 9/10 en Buenos Aires (UTC-3) → "2026-10-09T03:00:00.000Z".
 * `daysAgo` permite pedir el inicio de días anteriores.
 */
export function startOfDayInTimeZone(
  timeZone: string,
  now: Date = new Date(),
  daysAgo = 0,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const localMidnightAsUtc = Date.UTC(get('year'), get('month') - 1, get('day') - daysAgo)
  return new Date(
    localMidnightAsUtc - offsetMs(timeZone, new Date(localMidnightAsUtc)),
  ).toISOString()
}

/** Diferencia (ms) entre la hora local de la zona y UTC en ese instante. */
function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - at.getTime()
}
