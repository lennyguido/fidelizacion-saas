import { describe, expect, it } from 'vitest'
import { renderPreview } from './campaigns.ts'
import { percentChange } from './dashboard.ts'

describe('renderPreview', () => {
  it('replaces every placeholder', () => {
    expect(
      renderPreview('Hola {nombre}, en {negocio}: {beneficio}. ¡Chau {nombre}!', {
        nombre: 'Ana',
        negocio: 'Café',
        beneficio: '2x1',
      }),
    ).toBe('Hola Ana, en Café: 2x1. ¡Chau Ana!')
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
