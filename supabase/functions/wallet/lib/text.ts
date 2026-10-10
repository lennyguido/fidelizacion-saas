// Textos y colores que comparten Google y Apple. Funciones puras.
import type { PassData } from './passData.ts'

export const DEFAULT_BRAND = '#0f172a'

export function brandColor(color: string | null): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : DEFAULT_BRAND
}

/** Mismo criterio que textColorOn() del SDK: texto oscuro sobre fondos claros. */
export function textColorOn(hex: string): string {
  const channel = (start: number) => {
    const c = parseInt(hex.slice(start, start + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return luminance > 0.18 ? '#0f172a' : '#ffffff'
}

/** "#ff8800" → "rgb(255, 136, 0)" (formato de Apple). */
export function hexToRgb(hex: string): string {
  const n = (start: number) => parseInt(hex.slice(start, start + 2), 16)
  return `rgb(${n(1)}, ${n(3)}, ${n(5)})`
}

export function unitLabel(data: Pick<PassData, 'unit'>): string {
  return data.unit === 'sellos' ? 'Sellos' : 'Puntos'
}

/** Línea de "próxima recompensa" que se muestra en el pase. */
export function rewardText(
  data: Pick<PassData, 'active' | 'nextReward' | 'pointsBalance' | 'rewardsAvailable' | 'unit'>,
): string {
  if (!data.active) return 'Esta tarjeta ya no está activa.'
  if (data.rewardsAvailable > 0) {
    const n = data.rewardsAvailable
    return n === 1
      ? 'Ya podés canjear 1 recompensa en la caja.'
      : `Ya podés canjear ${n} recompensas en la caja.`
  }
  if (data.nextReward) {
    const missing = Math.max(0, data.nextReward.costPoints - data.pointsBalance)
    return `Te faltan ${missing} ${data.unit} para "${data.nextReward.name}".`
  }
  return `Sumás ${data.unit} en cada visita.`
}

/** URL pública del logo (bucket `logos`, D-024). */
export function publicLogoUrl(supabaseUrl: string, logoPath: string | null): string | null {
  if (!logoPath) return null
  const path = logoPath.split('/').map(encodeURIComponent).join('/')
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/logos/${path}`
}

/** Google y Apple solo aceptan PNG (Apple) o PNG/JPG (Google) para el logo. */
export function isPng(path: string | null): boolean {
  return !!path && /\.png$/i.test(path)
}

export function isPngOrJpeg(path: string | null): boolean {
  return !!path && /\.(png|jpe?g)$/i.test(path)
}
