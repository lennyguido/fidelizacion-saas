import { describe, expect, it } from 'vitest'
import { isValidSlug, slugify } from './slug.ts'

describe('slugify', () => {
  it('removes accents and symbols', () => {
    expect(slugify('Café Central')).toBe('cafe-central')
    expect(slugify('  Panadería  "La Espiga" ')).toBe('panaderia-la-espiga')
  })
  it('produces valid slugs', () => {
    expect(isValidSlug(slugify('Ñandú & Cía. S.R.L.'))).toBe(true)
  })
})
