import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayInTimeZone,
  gapOfferMessage,
  minutesOfDay,
  nextDays,
  tokenFromHash,
  weekStart,
  whatsappLink,
} from './booking.ts'

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

  it('arma la oferta para un hueco y el link de WhatsApp', () => {
    const text = gapOfferMessage({
      clientName: 'Juan Pérez',
      businessName: 'Barbería Sol',
      day: 'mañana',
      time: '15:00',
      discountPercent: 20,
      bookingUrl: 'https://turnos.neriva.net/barberia-sol',
    })
    expect(text).toContain('¡Hola Juan!')
    expect(text).toContain('mañana a las 15:00 con 20% de descuento')
    expect(
      gapOfferMessage({
        clientName: 'Ana',
        businessName: 'X',
        day: 'hoy',
        time: '10:00',
        discountPercent: 0,
        bookingUrl: 'u',
      }),
    ).not.toContain('descuento')
    expect(whatsappLink('+54 9 11 5555-0001', 'hola')).toBe('https://wa.me/5491155550001?text=hola')
  })
})
