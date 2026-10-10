// PNG de un solo color: ícono de respaldo cuando el negocio no subió un logo PNG.
import { crc32 } from './zip.ts'

async function zlibDeflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
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

export async function solidPng(width: number, height: number, hex: string): Promise<Uint8Array> {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const ihdr = new Uint8Array(13)
  const iv = new DataView(ihdr.buffer)
  iv.setUint32(0, width)
  iv.setUint32(4, height)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8 bits, RGB, sin entrelazado

  const row = 1 + width * 3
  const raw = new Uint8Array(row * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(rgb, y * row + 1 + x * 3)
  }

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await zlibDeflate(raw)),
    chunk('IEND', new Uint8Array()),
  ]
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}
