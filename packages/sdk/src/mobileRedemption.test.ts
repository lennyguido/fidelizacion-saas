import { describe, expect, it } from 'vitest'
import { looksLikeRequestCode, secondsLeft } from './mobileRedemption.ts'

describe('mobile redemption', () => {
  it('recognizes 6-character codes without ambiguous letters', () => {
    expect(looksLikeRequestCode('h4k9pz')).toBe(true)
    expect(looksLikeRequestCode('H4K9P0')).toBe(false)
    expect(looksLikeRequestCode('H4K9P')).toBe(false)
  })

  it('counts the seconds left and never goes below zero', () => {
    const now = Date.parse('2026-10-11T12:00:00Z')
    expect(secondsLeft('2026-10-11T12:05:00Z', now)).toBe(300)
    expect(secondsLeft('2026-10-11T11:59:00Z', now)).toBe(0)
  })
})
