import { describe, expect, it } from 'vitest'
import { change, groupWeekly, sourceGroup } from './stats.ts'

describe('stats', () => {
  it('groups visit sources for the chart', () => {
    expect(sourceGroup('manual')).toBe('counter')
    expect(sourceGroup('qr_business')).toBe('qr')
    expect(sourceGroup('pos')).toBe('register')
    expect(sourceGroup('import')).toBe('other')
    expect(
      groupWeekly([
        { week: '2026-10-05', source: 'manual', visits: 3 },
        { week: '2026-09-28', source: 'pos', visits: 2 },
        { week: '2026-10-05', source: 'qr_customer', visits: 1 },
        { week: '2026-10-05', source: 'manual', visits: 1 },
      ]),
    ).toEqual([
      { week: '2026-09-28', counter: 0, qr: 0, register: 2, other: 0 },
      { week: '2026-10-05', counter: 4, qr: 1, register: 0, other: 0 },
    ])
  })

  it('compares with the previous period only when there is a base', () => {
    expect(change(120, 100)).toBe(20)
    expect(change(5, 0)).toBeNull()
    expect(change(null, 10)).toBeNull()
  })
})
