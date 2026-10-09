/**
 * Convierte un monto escrito en formato argentino a unidades menores (centavos).
 * "8.500" → 850000 · "8500,50" → 850050 · "1.234.567,8" → 123456780.
 * Devuelve null si está vacío o no es un número válido.
 */
export function parseAmountToMinor(input: string): number | null {
  const cleaned = input.trim().replace(/\$|\s/g, '')
  if (cleaned === '') return null
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(cleaned)) return null

  const [integerPart = '0', decimalPart = ''] = cleaned.replace(/\./g, '').split(',')
  const minor = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}

/** 850000 → "$ 8.500" (sin decimales si son cero). */
export function formatMoney(minor: number | null | undefined, currency = 'ARS'): string {
  if (minor === null || minor === undefined) return '—'
  const value = minor / 100
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}
