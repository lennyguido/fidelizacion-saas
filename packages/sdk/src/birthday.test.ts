import { describe, expect, it } from 'vitest'
import { formatBirthday, isValidBirthday } from './birthday.ts'

describe('isValidBirthday', () => {
  it('accepts real dates, including February 29', () => {
    expect(isValidBirthday(1, 1)).toBe(true)
    expect(isValidBirthday(29, 2)).toBe(true)
    expect(isValidBirthday(30, 4)).toBe(true)
  })
  it('rejects impossible dates', () => {
    expect(isValidBirthday(30, 2)).toBe(false)
    expect(isValidBirthday(31, 4)).toBe(false)
    expect(isValidBirthday(0, 5)).toBe(false)
    expect(isValidBirthday(10, 13)).toBe(false)
  })
})

describe('formatBirthday', () => {
  it('writes the day and the month name', () => {
    expect(formatBirthday({ day: 3, month: 3 })).toBe('3 de marzo')
  })
})
