import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone.ts'

describe('normalizePhone', () => {
  it.each([
    ['11 2233-4455', '+5491122334455'],
    ['011 15 2233 4455', '+5491122334455'],
    ['(0351) 15 555-1234', '+5493515551234'],
    ['+54 9 11 2233 4455', '+5491122334455'],
    ['54 11 2233 4455', '+5491122334455'],
    ['5491122334455', '+5491122334455'],
    ['+1 415 555 2671', '+14155552671'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each(['', '   ', '123', 'hola', '+0 11 2233'])('rejects %j', (input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('formatPhone', () => {
  it('formats Buenos Aires mobiles', () => {
    expect(formatPhone('+5491122334455')).toBe('+54 9 11 2233-4455')
  })
  it('keeps other numbers as they are', () => {
    expect(formatPhone('+14155552671')).toBe('+14155552671')
  })
  it('handles empty values', () => {
    expect(formatPhone(null)).toBe('')
  })
})
