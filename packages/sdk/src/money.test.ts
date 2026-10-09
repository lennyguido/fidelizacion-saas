import { describe, expect, it } from 'vitest'
import { formatMoney, parseAmountToMinor } from './money.ts'

describe('parseAmountToMinor', () => {
  it.each([
    ['8500', 850000],
    ['8.500', 850000],
    ['$ 8.500', 850000],
    ['8500,5', 850050],
    ['1.234.567,89', 123456789],
    ['0', 0],
  ])('%s → %d', (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected)
  })

  it.each(['', 'abc', '8,500.00', '-100', '1.23', '12,345'])('rejects %j', (input) => {
    expect(parseAmountToMinor(input)).toBeNull()
  })
})

describe('formatMoney', () => {
  it('formats pesos without decimals when they are zero', () => {
    expect(formatMoney(850000).replace(/\s/g, ' ')).toBe('$ 8.500')
  })
  it('shows decimals when present', () => {
    expect(formatMoney(850050).replace(/\s/g, ' ')).toBe('$ 8.500,50')
  })
  it('shows a dash for missing amounts', () => {
    expect(formatMoney(null)).toBe('—')
  })
})
