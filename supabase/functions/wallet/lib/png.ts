// PNG en TypeScript puro (sin dependencias nativas): codificar una imagen RGBA y leer
// los PNG comunes (los logos del negocio). Usa solo CompressionStream / DecompressionStream.
import { crc32 } from '../apple/zip.ts'

export interface RgbaImage {
  width: number
  height: number
  /** 4 bytes por píxel (R, G, B, A), fila por fila. */
  pixels: Uint8Array
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Límites para leer logos: más grande que esto no se usa (se dibuja el tilde). */
export const MAX_DECODE_SIDE = 4096
export const MAX_DECODE_PIXELS = 4_000_000

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(piped).arrayBuffer())
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  const typeAndData = new Uint8Array(4 + data.length)
  typeAndData.set(new TextEncoder().encode(type), 0)
  typeAndData.set(data, 4)
  out.set(typeAndData, 4)
  view.setUint32(8 + data.length, crc32(typeAndData))
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

/** RGBA → PNG (8 bits, color tipo 6, sin filtro). Mismo dibujo → mismos bytes. */
export async function encodePng(image: RgbaImage): Promise<Uint8Array> {
  const { width, height, pixels } = image
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr.set([8, 6, 0, 0, 0], 8) // 8 bits, RGBA, sin entrelazado

  const row = 1 + width * 4
  const raw = new Uint8Array(row * height)
  for (let y = 0; y < height; y++) {
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * row + 1)
  }
  return concat([
    new Uint8Array(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', await transform(raw, new CompressionStream('deflate'))),
    chunk('IEND', new Uint8Array()),
  ])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
const DEPTHS: Record<number, number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
}

/**
 * Lee un PNG no entrelazado (gris, RGB, paleta, con o sin transparencia; 1 a 16 bits).
 * Devuelve null si el archivo no es un PNG que se sepa leer o es demasiado grande.
 */
export async function decodePng(bytes: Uint8Array): Promise<RgbaImage | null> {
  try {
    return await decode(bytes)
  } catch {
    return null
  }
}

async function decode(bytes: Uint8Array): Promise<RgbaImage | null> {
  if (bytes.length < 33 || SIGNATURE.some((b, i) => bytes[i] !== b)) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  let depth = 0
  let colorType = -1
  let interlace = 0
  let palette: Uint8Array | null = null
  let alphaTable: Uint8Array | null = null
  let transparentGray: number | null = null
  let transparentRgb: [number, number, number] | null = null
  const idat: Uint8Array[] = []

  for (let pos = 8; pos + 12 <= bytes.length; ) {
    const length = view.getUint32(pos)
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
    const data = bytes.subarray(pos + 8, pos + 8 + length)
    if (data.length !== length) return null
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8)
      height = view.getUint32(pos + 12)
      depth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') {
      if (colorType === 3) alphaTable = data
      else if (colorType === 0 && length >= 2) transparentGray = (data[0] << 8) | data[1]
      else if (colorType === 2 && length >= 6) {
        transparentRgb = [
          (data[0] << 8) | data[1],
          (data[2] << 8) | data[3],
          (data[4] << 8) | data[5],
        ]
      }
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + length
  }

  if (!(colorType in CHANNELS) || !DEPTHS[colorType].includes(depth) || interlace !== 0) return null
  if (width < 1 || height < 1 || width > MAX_DECODE_SIDE || height > MAX_DECODE_SIDE) return null
  if (width * height > MAX_DECODE_PIXELS || idat.length === 0) return null
  if (colorType === 3 && !palette) return null

  const channels = CHANNELS[colorType]
  const bitsPerPixel = channels * depth
  const stride = Math.ceil((width * bitsPerPixel) / 8)
  const bpp = Math.max(1, bitsPerPixel >> 3)
  const raw = await transform(concat(idat), new DecompressionStream('deflate'))
  if (raw.length < (stride + 1) * height) return null

  // Deshacer los filtros de cada fila.
  const data = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const off = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? data[off + x - bpp] : 0
      const b = y > 0 ? data[off - stride + x] : 0
      const c = x >= bpp && y > 0 ? data[off - stride + x - bpp] : 0
      let value = src[x]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) value += paeth(a, b, c)
      else if (filter !== 0) return null
      data[off + x] = value & 0xff
    }
  }

  const sample = (row: number, index: number): number => {
    if (depth === 8) return data[row + index]
    if (depth === 16) return (data[row + index * 2] << 8) | data[row + index * 2 + 1]
    const bit = index * depth
    return (data[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1)
  }
  const max = (1 << depth) - 1
  const to8 = (v: number) => (depth === 16 ? v >> 8 : depth === 8 ? v : Math.round((v * 255) / max))

  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const row = y * stride
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      if (colorType === 3) {
        const i = sample(row, x)
        pixels[o] = palette![i * 3] ?? 0
        pixels[o + 1] = palette![i * 3 + 1] ?? 0
        pixels[o + 2] = palette![i * 3 + 2] ?? 0
        pixels[o + 3] = alphaTable && i < alphaTable.length ? alphaTable[i] : 255
      } else if (colorType === 0 || colorType === 4) {
        const g = sample(row, x * channels)
        pixels[o] = pixels[o + 1] = pixels[o + 2] = to8(g)
        pixels[o + 3] =
          colorType === 4 ? to8(sample(row, x * channels + 1)) : g === transparentGray ? 0 : 255
      } else {
        const r = sample(row, x * channels)
        const g = sample(row, x * channels + 1)
        const b = sample(row, x * channels + 2)
        pixels[o] = to8(r)
        pixels[o + 1] = to8(g)
        pixels[o + 2] = to8(b)
        pixels[o + 3] =
          colorType === 6
            ? to8(sample(row, x * channels + 3))
            : transparentRgb &&
                r === transparentRgb[0] &&
                g === transparentRgb[1] &&
                b === transparentRgb[2]
              ? 0
              : 255
      }
    }
  }
  return { width, height, pixels }
}
