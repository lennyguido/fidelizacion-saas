import { describe, expect, it } from 'vitest'
import { startOfDayInTimeZone } from './dates.ts'

describe('startOfDayInTimeZone', () => {
  const now = new Date('2026-10-09T13:20:00Z') // 10:20 en Buenos Aires

  it('returns local midnight in Buenos Aires (UTC-3)', () => {
    expect(startOfDayInTimeZone('America/Argentina/Buenos_Aires', now)).toBe(
      '2026-10-09T03:00:00.000Z',
    )
  })

  it('goes back whole days', () => {
    expect(startOfDayInTimeZone('America/Argentina/Buenos_Aires', now, 6)).toBe(
      '2026-10-03T03:00:00.000Z',
    )
  })

  it('uses the business date, not UTC (late night)', () => {
    const lateNight = new Date('2026-10-10T01:30:00Z') // 22:30 del 9/10 en Buenos Aires
    expect(startOfDayInTimeZone('America/Argentina/Buenos_Aires', lateNight)).toBe(
      '2026-10-09T03:00:00.000Z',
    )
  })

  it('handles zones ahead of UTC', () => {
    expect(startOfDayInTimeZone('Europe/Madrid', now)).toBe('2026-10-08T22:00:00.000Z')
  })
})
