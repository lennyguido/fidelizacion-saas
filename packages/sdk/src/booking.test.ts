import { describe, expect, it } from 'vitest'
import { addDays, dayInTimeZone, minutesOfDay, nextDays, tokenFromHash, weekStart } from './booking.ts'

describe('turnos', () => {
  it('calcula el día en la zona del negocio', () => {
    // 02:00 UTC del 13/10 = 23:00 del 12/10 en Buenos Aires.
    expect(dayInTimeZone(new Date('2026-10-13T02:00:00Z'), 'America/Argentina/Buenos_Aires')).toBe(
      '2026-10-12',
    )
  })

  it('arma los próximos días sin repetir', () => {
    const days = nextDays('America/Argentina/Buenos_Aires', 3, new Date('2026-10-13T02:00:00Z'))
    expect(days).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
  })

  it('solo acepta códigos de turno válidos', () => {
    expect(tokenFromHash('#' + 'a'.repeat(64))).toBe('a'.repeat(64))
    expect(tokenFromHash('#hola')).toBeNull()
  })

  it('calcula semanas y minutos del día', () => {
    expect(weekStart('2026-10-15')).toBe('2026-10-12')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(minutesOfDay('2026-10-13T13:30:00Z', 'America/Argentina/Buenos_Aires')).toBe(630)
  })
})
