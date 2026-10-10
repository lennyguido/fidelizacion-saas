// Imagen de la fila de sellos (Google: heroImage; Apple: strip.png). Se dibuja en
// TypeScript puro, píxel por píxel, sin librerías nativas ni WASM: fondo del color de
// la marca, casilleros llenos con el logo del negocio (o un tilde si no hay logo PNG)
// y casilleros vacíos como un anillo. Mismos datos → mismos bytes.
import { encodePng, type RgbaImage } from './png.ts'
import { brandColor, textColorOn } from './text.ts'

export const GOOGLE_HERO_SIZE = { width: 1032, height: 336 } as const
export const APPLE_STRIP_SIZE = { width: 375, height: 144 } as const
export const APPLE_STRIP_2X_SIZE = { width: 750, height: 288 } as const

export interface StampImageInput {
  width: number
  height: number
  total: number
  filled: number
  /** Color de la marca (#rrggbb); si no es válido se usa el de respaldo. */
  color: string | null
  /** Logo ya leído (decodePng); null → tilde. */
  logo: RgbaImage | null
}

type Rgb = [number, number, number]

function hex(color: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as Rgb
}

export interface StampSlot {
  cx: number
  cy: number
  r: number
}

/** Hasta 10 por fila (2 filas para 11–20), centrados; la última fila puede tener menos. */
export function stampLayout(width: number, height: number, total: number): StampSlot[] {
  const cols = total <= 10 ? total : Math.ceil(total / 2)
  const rows = Math.ceil(total / cols)
  const padX = width * 0.04
  const padY = height * 0.1
  const cellW = (width - 2 * padX) / cols
  const cellH = (height - 2 * padY) / rows
  const r = Math.min(cellW, cellH) * 0.42
  const slots: StampSlot[] = []
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / cols)
    const inRow = row === rows - 1 ? total - row * cols : cols
    const col = i - row * cols
    const rowStart = padX + ((cols - inRow) * cellW) / 2
    slots.push({ cx: rowStart + (col + 0.5) * cellW, cy: padY + (row + 0.5) * cellH, r })
  }
  return slots
}

class Canvas {
  readonly pixels: Uint8Array
  constructor(
    readonly width: number,
    readonly height: number,
    background: Rgb,
  ) {
    this.pixels = new Uint8Array(width * height * 4)
    for (let i = 0; i < width * height; i++) this.pixels.set([...background, 255], i * 4)
  }

  /** Mezcla un color sobre el píxel (alpha 0..1). */
  blend(x: number, y: number, [r, g, b]: Rgb, alpha: number) {
    if (alpha <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return
    const o = (y * this.width + x) * 4
    const a = Math.min(1, alpha)
    this.pixels[o] = Math.round(this.pixels[o] + (r - this.pixels[o]) * a)
    this.pixels[o + 1] = Math.round(this.pixels[o + 1] + (g - this.pixels[o + 1]) * a)
    this.pixels[o + 2] = Math.round(this.pixels[o + 2] + (b - this.pixels[o + 2]) * a)
  }

  /** Recorre los píxeles del cuadrado que contiene el círculo. */
  each(slot: StampSlot, pad: number, fn: (x: number, y: number, dist: number) => void) {
    const x0 = Math.max(0, Math.floor(slot.cx - slot.r - pad))
    const x1 = Math.min(this.width - 1, Math.ceil(slot.cx + slot.r + pad))
    const y0 = Math.max(0, Math.floor(slot.cy - slot.r - pad))
    const y1 = Math.min(this.height - 1, Math.ceil(slot.cy + slot.r + pad))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        fn(x, y, Math.hypot(x + 0.5 - slot.cx, y + 0.5 - slot.cy))
      }
    }
  }
}

const coverage = (edge: number) => Math.max(0, Math.min(1, edge + 0.5))

function distanceToSegment(px: number, py: number, [ax, ay]: number[], [bx, by]: number[]): number {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/** Achica (o agranda) el logo a side×side, entrando entero y centrado, con su transparencia. */
export function fitLogo(logo: RgbaImage, side: number): RgbaImage {
  const out = new Uint8Array(side * side * 4)
  const scale = side / Math.max(logo.width, logo.height)
  const dw = logo.width * scale
  const dh = logo.height * scale
  const offX = (side - dw) / 2
  const offY = (side - dh) / 2
  for (let y = 0; y < side; y++) {
    const sy0 = (y - offY) / scale
    const sy1 = (y + 1 - offY) / scale
    for (let x = 0; x < side; x++) {
      const sx0 = (x - offX) / scale
      const sx1 = (x + 1 - offX) / scale
      // Promedio del área de origen que cae en este píxel (con alpha premultiplicado).
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let area = 0
      for (
        let sy = Math.max(0, Math.floor(sy0));
        sy < Math.min(logo.height, Math.ceil(sy1));
        sy++
      ) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0)
        for (
          let sx = Math.max(0, Math.floor(sx0));
          sx < Math.min(logo.width, Math.ceil(sx1));
          sx++
        ) {
          const w = wy * (Math.min(sx + 1, sx1) - Math.max(sx, sx0))
          if (w <= 0) continue
          const o = (sy * logo.width + sx) * 4
          const alpha = (logo.pixels[o + 3] / 255) * w
          r += logo.pixels[o] * alpha
          g += logo.pixels[o + 1] * alpha
          b += logo.pixels[o + 2] * alpha
          a += alpha
          area += w
        }
      }
      if (area <= 0 || a <= 0) continue
      const o = (y * side + x) * 4
      out[o] = Math.round(r / a)
      out[o + 1] = Math.round(g / a)
      out[o + 2] = Math.round(b / a)
      out[o + 3] = Math.round((a / ((sx1 - sx0) * (sy1 - sy0))) * 255)
    }
  }
  return { width: side, height: side, pixels: out }
}

/** Dibuja la fila de sellos en memoria (RGBA). */
export function renderStamps(input: StampImageInput): RgbaImage {
  const width = Math.max(1, Math.trunc(input.width))
  const height = Math.max(1, Math.trunc(input.height))
  const total = Math.max(1, Math.min(20, Math.trunc(input.total)))
  const filled = Math.max(0, Math.min(total, Math.trunc(input.filled)))
  const brand = brandColor(input.color)
  const brandRgb = hex(brand)
  const fg = hex(textColorOn(brand))
  const lightBrand = textColorOn(brand) !== '#ffffff'
  const white: Rgb = [255, 255, 255]
  const check: Rgb = lightBrand ? hex('#0f172a') : brandRgb

  const canvas = new Canvas(width, height, brandRgb)
  const slots = stampLayout(width, height, total)
  const ring = Math.max(1, slots[0].r * 0.1)
  const logoSide = Math.max(1, Math.round(slots[0].r * 2 * 0.8))
  const logo = input.logo ? fitLogo(input.logo, logoSide) : null

  slots.forEach((slot, index) => {
    if (index >= filled) {
      // Vacío: anillo suave + relleno muy tenue.
      canvas.each(slot, 1, (x, y, d) => {
        canvas.blend(x, y, fg, coverage(slot.r - d) * 0.1)
        canvas.blend(x, y, fg, coverage(ring / 2 - Math.abs(d - slot.r + ring / 2)) * 0.55)
      })
      return
    }
    // Lleno: disco blanco (con borde si la marca es clara) y el logo o un tilde.
    canvas.each(slot, 1, (x, y, d) => {
      canvas.blend(x, y, white, coverage(slot.r - d))
      if (lightBrand)
        canvas.blend(x, y, fg, coverage(ring / 2 - Math.abs(d - slot.r + ring / 2)) * 0.35)
    })
    if (logo) {
      const inner = slot.r * 0.86
      const left = Math.round(slot.cx - logoSide / 2)
      const top = Math.round(slot.cy - logoSide / 2)
      canvas.each(slot, 0, (x, y, d) => {
        const lx = x - left
        const ly = y - top
        if (lx < 0 || ly < 0 || lx >= logoSide || ly >= logoSide) return
        const o = (ly * logoSide + lx) * 4
        const alpha = (logo.pixels[o + 3] / 255) * coverage(inner - d)
        canvas.blend(x, y, [logo.pixels[o], logo.pixels[o + 1], logo.pixels[o + 2]], alpha)
      })
    } else {
      const r = slot.r
      const points = [
        [slot.cx - 0.42 * r, slot.cy + 0.02 * r],
        [slot.cx - 0.12 * r, slot.cy + 0.32 * r],
        [slot.cx + 0.45 * r, slot.cy - 0.3 * r],
      ]
      const half = 0.11 * r
      canvas.each(slot, 0, (x, y) => {
        const px = x + 0.5
        const py = y + 0.5
        const d = Math.min(
          distanceToSegment(px, py, points[0], points[1]),
          distanceToSegment(px, py, points[1], points[2]),
        )
        canvas.blend(x, y, check, coverage(half - d))
      })
    }
  })

  return { width, height, pixels: canvas.pixels }
}

export async function stampPng(input: StampImageInput): Promise<Uint8Array> {
  return await encodePng(renderStamps(input))
}
