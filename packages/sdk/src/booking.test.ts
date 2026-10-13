import { describe, expect, it } from 'vitest'
import { dayInTimeZone, nextDays, tokenFromHash } from './booking.ts'

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
})
