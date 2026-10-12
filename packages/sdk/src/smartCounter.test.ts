import { describe, expect, it } from 'vitest'
import { sinceText, snapshotLine, type CustomerSnapshot } from './smartCounter.ts'

const now = Date.parse('2026-10-11T12:00:00Z')

describe('smart counter', () => {
  it('says since when in plain words', () => {
    expect(sinceText('2026-10-11T08:00:00Z', now)).toBe('desde hoy')
    expect(sinceText('2026-10-10T08:00:00Z', now)).toBe('hace 1 día')
    expect(sinceText('2026-07-01T12:00:00Z', now)).toBe('hace 3 meses')
    expect(sinceText('2024-09-01T12:00:00Z', now)).toBe('hace 2 años')
  })

  it('builds the one-line summary for the counter', () => {
    const snap: CustomerSnapshot = {
      customerId: 'a',
      name: 'Ana',
      customerSince: '2024-09-01T12:00:00Z',
      visitCount: 49,
      nextVisitNumber: 50,
      medianIntervalDays: 9,
      lastVisitAt: null,
      status: 'ACTIVE',
      note: null,
      totalSpendMinor: null,
    }
    expect(snapshotLine(snap, now)).toBe('hace 2 años · visita 50 · viene cada ~9 días')
    expect(snapshotLine({ ...snap, medianIntervalDays: null }, now)).toBe('hace 2 años · visita 50')
  })
})
