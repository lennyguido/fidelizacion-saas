import { describe, expect, it } from 'vitest'
import { referralShareText } from './card.ts'
import { AppError } from './errors.ts'
import { isValidReviewUrl } from './feedback.ts'
import { setReferrerErrorMessage } from './referrals.ts'

describe('referrals', () => {
  it('builds the WhatsApp invite with the code', () => {
    expect(
      referralShareText('Café Sol', { code: 'ABC234', referrerPoints: 5, friendPoints: 3 }),
    ).toBe(
      'Te invito a sumarte al club de Café Sol y te regalan 3 en tu primera visita. En la caja decí mi código: ABC234',
    )
    expect(
      referralShareText('Café Sol', { code: 'ABC234', referrerPoints: 5, friendPoints: 0 }),
    ).not.toContain('regalan')
  })

  it('translates the database errors for the counter', () => {
    expect(setReferrerErrorMessage(new AppError('invalid', 'friend already has visits'))).toContain(
      'sin visitas',
    )
    expect(setReferrerErrorMessage(new AppError('unknown', 'boom'))).toBeNull()
  })
})

describe('isValidReviewUrl', () => {
  it('accepts only Google review links', () => {
    expect(isValidReviewUrl('https://g.page/r/abc123/review')).toBe(true)
    expect(isValidReviewUrl('https://maps.app.goo.gl/xyz')).toBe(true)
    expect(isValidReviewUrl('https://search.google.com/local/writereview?placeid=1')).toBe(true)
    expect(isValidReviewUrl('https://www.google.com/maps/place/x')).toBe(true)
    expect(isValidReviewUrl('http://g.page/r/abc')).toBe(false)
    expect(isValidReviewUrl('https://g.page.evil.com/r')).toBe(false)
    expect(isValidReviewUrl('https://evil.example/review')).toBe(false)
    expect(isValidReviewUrl('https://www.google.com.evil.com/x')).toBe(false)
    expect(isValidReviewUrl('https://www.google.com.ar/maps/place/x')).toBe(true)
  })
})
