import type { SourceGroup } from '@plataforma/sdk'

// Colores de los gráficos (paleta validada con el método de dataviz: orden fijo,
// nunca rotado). Verde y amarillo tienen poco contraste sobre blanco: por eso cada
// gráfico muestra también los números escritos (leyenda con valores).
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] as const

export const SOURCE_COLORS: Record<SourceGroup, string> = {
  counter: SERIES[0],
  qr: SERIES[1],
  register: SERIES[2],
  other: SERIES[3],
}

export const GRID = '#ededf0'
export const AXIS_STYLE = { fontSize: 12, fill: '#707070' }

/** "2026-10-05" → "5/10". */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${Number(day)}/${Number(month)}`
}
