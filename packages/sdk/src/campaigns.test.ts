import { describe, expect, it } from 'vitest'
import { looksLikeCouponCode, renderPreview } from './campaigns.ts'
import { percentChange } from './dashboard.ts'

describe('renderPreview', () => {
  it('replaces every placeholder', () => {
    expect(
      renderPreview('Hola {nombre}, en {negocio}: {beneficio} con {cupon}. ¡Chau {nombre}!', {
        nombre: 'Ana',
        negocio: 'Café',
        beneficio: '2x1',
        cupon: 'K7P2QX',
      }),
    ).toBe('Hola Ana, en Café: 2x1 con K7P2QX. ¡Chau Ana!')
  })
})

describe('looksLikeCouponCode', () => {
  it('accepts 6 characters ignoring case, spaces and dashes', () => {
    expect(looksLikeCouponCode('K7P2QX')).toBe(true)
    expect(looksLikeCouponCode('k7p-2qx')).toBe(true)
  })
  it('rejects member codes and ambiguous characters', () => {
    expect(looksLikeCouponCode('ABCDEFGH')).toBe(false)
    expect(looksLikeCouponCode('K7P2Q0')).toBe(false)
  })
})

describe('percentChange', () => {
  it('rounds the change', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(90, 120)).toBe(-25)
  })
  it('returns null without a base', () => {
    expect(percentChange(10, 0)).toBeNull()
  })
})
