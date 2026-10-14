import type { CSSProperties } from 'react'

const DEFAULT_BRAND = '#b0175a'

/** Color del negocio y el color de texto que se lee encima (blanco u oscuro). */
export function brandStyle(color: string | null | undefined): CSSProperties {
  const brand = color && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRAND
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(brand.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6
  return { '--brand': brand, '--on-brand': light ? '#1e1b2e' : '#ffffff' } as CSSProperties
}
