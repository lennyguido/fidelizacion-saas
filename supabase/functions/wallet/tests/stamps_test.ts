import assert from 'node:assert/strict'
import { crc32 } from '../apple/zip.ts'
import { buildPassJson } from '../apple/pass.ts'
import { passImages } from '../apple/handlers.ts'
import { buildLoyaltyObject, buildObjectPatch } from '../google/objects.ts'
import { decodePng, encodePng, type RgbaImage } from '../lib/png.ts'
import {
  APPLE_STRIP_2X_SIZE,
  APPLE_STRIP_SIZE,
  GOOGLE_HERO_SIZE,
  fitLogo,
  renderStamps,
  stampLayout,
  stampPng,
} from '../lib/stampImage.ts'
import {
  MAX_STAMPS,
  brandVersion,
  parseStampParams,
  stampImageBase,
  stampImageUrl,
  stampView,
} from '../lib/stamps.ts'
import { createHandler } from '../router.ts'
import { clearStampCache, IMMUTABLE, SHORT_CACHE } from '../stamps/handler.ts'
import { BASE_ENV, fakeRpc, passData } from './helpers.ts'

const BIZ = '22222222-2222-2222-2222-222222222222'
const BASE = 'https://demo-ref.supabase.co/functions/v1/wallet/stamps.png'
const stampData = (overrides = {}) =>
  passData({ unit: 'sellos', programKind: 'stamps', stampGoal: 6, pointsBalance: 3, ...overrides })

function pixel(image: RgbaImage, x: number, y: number): number[] {
  const o = (Math.floor(y) * image.width + Math.floor(x)) * 4
  return Array.from(image.pixels.subarray(o, o + 4))
}

function solid(width: number, height: number, rgba: number[]): RgbaImage {
  const pixels = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) pixels.set(rgba, i * 4)
  return { width, height, pixels }
}

function ihdrSize(png: Uint8Array): [number, number] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

// PNG armado a mano (para probar paletas, gris y filtros que encodePng no usa).
async function handPng(
  width: number,
  height: number,
  depth: number,
  colorType: number,
  raw: number[],
  extra: [string, number[]][] = [],
): Promise<Uint8Array> {
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array(4 + data.length)
    body.set(new TextEncoder().encode(type))
    body.set(data, 4)
    const out = new Uint8Array(12 + data.length)
    const view = new DataView(out.buffer)
    view.setUint32(0, data.length)
    out.set(body, 4)
    view.setUint32(8 + data.length, crc32(body))
    return out
  }
  const ihdr = new Uint8Array(13)
  new DataView(ihdr.buffer).setUint32(0, width)
  new DataView(ihdr.buffer).setUint32(4, height)
  ihdr.set([depth, colorType, 0, 0, 0], 8)
  const stream = new Blob([new Uint8Array(raw)])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  const idat = new Uint8Array(await new Response(stream).arrayBuffer())
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...extra.map(([type, data]) => chunk(type, new Uint8Array(data))),
    chunk('IDAT', idat),
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

// --- Regla de casilleros ---------------------------------------------------------------

Deno.test('stampView: one slot per stamp toward the goal', () => {
  assert.deepEqual(stampView(stampData()), { total: 6, filled: 3 })
  assert.deepEqual(stampView(stampData({ pointsBalance: 0 })), { total: 6, filled: 0 })
  assert.deepEqual(stampView(stampData({ pointsBalance: 9 })), { total: 6, filled: 6 })
})

Deno.test('stampView: capped at 20 and filled in proportion', () => {
  assert.deepEqual(stampView(stampData({ stampGoal: 30, pointsBalance: 15 })), {
    total: MAX_STAMPS,
    filled: 10,
  })
})

Deno.test('stampView: no stamps without rewards, inactive, or big point rewards', () => {
  assert.equal(stampView(stampData({ stampGoal: null })), null)
  assert.equal(stampView(stampData({ active: false })), null)
  assert.equal(stampView(passData({ stampGoal: 50 })), null)
  assert.deepEqual(stampView(passData({ stampGoal: 10, pointsBalance: 7 })), {
    total: 10,
    filled: 7,
  })
})

// --- URL ------------------------------------------------------------------------------

Deno.test('brandVersion is short, stable and changes with logo or color', () => {
  const v = brandVersion('biz/logo-1.png', '#FF8800')
  assert.match(v, /^[0-9a-f]{8}$/)
  assert.equal(v, brandVersion('biz/logo-1.png', '#ff8800'))
  assert.notEqual(v, brandVersion('biz/logo-2.png', '#ff8800'))
  assert.notEqual(v, brandVersion('biz/logo-1.png', '#008800'))
})

Deno.test('stampImageUrl carries business, filled, total and brand version', () => {
  assert.equal(stampImageBase('https://demo-ref.supabase.co/'), BASE)
  const url = new URL(stampImageUrl(BASE, stampData())!)
  assert.equal(url.origin + url.pathname, BASE)
  assert.equal(url.searchParams.get('b'), BIZ)
  assert.equal(url.searchParams.get('n'), '3')
  assert.equal(url.searchParams.get('t'), '6')
  assert.equal(url.searchParams.get('v'), brandVersion('biz/logo-1.png', '#ff8800'))
  assert.deepEqual(parseStampParams(url.searchParams), {
    businessId: BIZ,
    filled: 3,
    total: 6,
    version: brandVersion('biz/logo-1.png', '#ff8800'),
  })
  assert.equal(stampImageUrl(BASE, stampData({ stampGoal: null })), null)
})

Deno.test('parseStampParams rejects anything out of range', () => {
  const p = (query: string) => parseStampParams(new URLSearchParams(query))
  const ok = `b=${BIZ}&v=0a1b2c3d`
  assert.ok(p(`${ok}&n=0&t=1`))
  assert.ok(p(`${ok}&n=20&t=20`))
  assert.equal(p(`${ok}&n=0&t=21`), null)
  assert.equal(p(`${ok}&n=0&t=0`), null)
  assert.equal(p(`${ok}&n=4&t=3`), null)
  assert.equal(p(`${ok}&n=-1&t=3`), null)
  assert.equal(p(`${ok}&n=1.5&t=3`), null)
  assert.equal(p(`${ok}&n=01&t=3`), null)
  assert.equal(p(`b=nope&v=0a1b2c3d&n=1&t=3`), null)
  assert.equal(p(`b=${BIZ}&v=xyz&n=1&t=3`), null)
  assert.equal(p(`b=${BIZ}&n=1&t=3`), null)
})

// --- PNG ------------------------------------------------------------------------------

Deno.test('encodePng → decodePng returns the same pixels', async () => {
  const image = solid(3, 2, [10, 20, 30, 128])
  image.pixels.set([255, 0, 0, 255], 4)
  const decoded = await decodePng(await encodePng(image))
  assert.ok(decoded)
  assert.equal(decoded.width, 3)
  assert.equal(decoded.height, 2)
  assert.deepEqual(Array.from(decoded.pixels), Array.from(image.pixels))
})

Deno.test('decodePng reads palette + transparency, gray and every row filter', async () => {
  // Paleta de 2 colores, 1 bit por píxel, el segundo transparente a medias.
  const palette = await handPng(
    4,
    1,
    1,
    3,
    [0, 0b0101_0000],
    [
      ['PLTE', [255, 0, 0, 0, 0, 255]],
      ['tRNS', [255, 100]],
    ],
  )
  const p = (await decodePng(palette))!
  assert.deepEqual(pixel(p, 0, 0), [255, 0, 0, 255])
  assert.deepEqual(pixel(p, 1, 0), [0, 0, 255, 100])

  // Gris 8 bits, 2×5, una fila con cada filtro (0..4). Todas deben dar 7, 9.
  const rows = [
    [0, 7, 9], // None
    [1, 7, 2], // Sub: 9 = 2 + 7
    [2, 0, 0], // Up: igual a la fila de arriba
    [3, 4, 1], // Average: 7 = 4 + floor((0 + 7) / 2); 9 = 1 + floor((7 + 9) / 2)
    [4, 0, 0], // Paeth: elige el de arriba
  ]
  const gray = (await decodePng(await handPng(2, 5, 8, 0, rows.flat())))!
  for (let y = 0; y < 5; y++) {
    assert.deepEqual([pixel(gray, 0, y)[0], pixel(gray, 1, y)[0]], [7, 9], `row ${y}`)
    assert.equal(pixel(gray, 0, y)[3], 255)
  }
})

Deno.test('decodePng refuses non-PNG, interlaced and oversized images', async () => {
  assert.equal(await decodePng(new TextEncoder().encode('GIF89a not a png at all......')), null)
  const interlaced = await handPng(1, 1, 8, 0, [0, 1])
  interlaced[8 + 8 + 12] = 1 // byte de entrelazado del IHDR
  assert.equal(await decodePng(interlaced), null)
  const huge = await handPng(5000, 1, 8, 0, [0])
  assert.equal(await decodePng(huge), null)
})

// --- Imagen de sellos -----------------------------------------------------------------

Deno.test('stampLayout: up to 10 per row, centered, inside the image', () => {
  assert.equal(stampLayout(1032, 336, 6).length, 6)
  const twenty = stampLayout(1032, 336, 20)
  assert.equal(new Set(twenty.map((s) => s.cy)).size, 2)
  for (const s of twenty) {
    assert.ok(s.cx - s.r >= 0 && s.cx + s.r <= 1032 && s.cy - s.r >= 0 && s.cy + s.r <= 336)
  }
  const seven = stampLayout(750, 288, 7)
  assert.equal(new Set(seven.map((s) => s.cy)).size, 1)
  assert.ok(Math.abs(seven[3].cx - 375) < 1, 'the middle stamp is centered')
})

Deno.test('renderStamps: brand background, white filled stamps, faint empty ones', () => {
  const image = renderStamps({
    width: 375,
    height: 144,
    total: 6,
    filled: 3,
    color: '#ff8800',
    logo: null,
  })
  assert.equal(image.width, 375)
  assert.equal(image.height, 144)
  assert.equal(image.pixels.length, 375 * 144 * 4)
  assert.deepEqual(pixel(image, 0, 0), [255, 136, 0, 255])
  const slots = stampLayout(375, 144, 6)
  // Lleno: disco blanco (lejos del tilde).
  assert.deepEqual(pixel(image, slots[0].cx, slots[0].cy - slots[0].r * 0.6), [255, 255, 255, 255])
  // Vacío: casi el color de la marca.
  const empty = pixel(image, slots[5].cx, slots[5].cy)
  assert.ok(empty[0] > 200 && empty[1] > 120 && empty[1] < 170, `empty stamp ${empty}`)
})

Deno.test('renderStamps puts the logo inside the filled stamps', () => {
  const logo = solid(40, 20, [200, 0, 0, 255])
  const image = renderStamps({
    width: 375,
    height: 144,
    total: 3,
    filled: 1,
    color: '#0f172a',
    logo,
  })
  const [first, , last] = stampLayout(375, 144, 3)
  assert.deepEqual(pixel(image, first.cx, first.cy), [200, 0, 0, 255])
  assert.notDeepEqual(pixel(image, last.cx, last.cy).slice(0, 3), [200, 0, 0])
})

Deno.test('fitLogo keeps the proportions (letterbox is transparent)', () => {
  const fitted = fitLogo(solid(40, 20, [0, 0, 255, 255]), 20)
  assert.deepEqual(pixel(fitted, 10, 10), [0, 0, 255, 255])
  assert.equal(pixel(fitted, 10, 1)[3], 0)
})

Deno.test('stampPng: right sizes and deterministic bytes', async () => {
  const input = { total: 8, filled: 5, color: '#336699', logo: solid(10, 10, [0, 200, 0, 255]) }
  const a = await stampPng({ ...GOOGLE_HERO_SIZE, ...input })
  const b = await stampPng({ ...GOOGLE_HERO_SIZE, ...input })
  assert.deepEqual(Array.from(a.slice(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.deepEqual(ihdrSize(a), [1032, 336])
  assert.deepEqual(a, b)
  assert.deepEqual(ihdrSize(await stampPng({ ...APPLE_STRIP_SIZE, ...input })), [375, 144])
  assert.deepEqual(ihdrSize(await stampPng({ ...APPLE_STRIP_2X_SIZE, ...input })), [750, 288])
  const decoded = (await decodePng(a))!
  assert.deepEqual(decoded.pixels, renderStamps({ ...GOOGLE_HERO_SIZE, ...input }).pixels)
})

// --- Google y Apple -------------------------------------------------------------------

Deno.test('Google: the object carries the stamp row as heroImage (also on sync)', () => {
  const object = buildLoyaltyObject('3388000000012345678', stampData(), BASE)
  assert.ok(object.heroImage)
  assert.equal(object.heroImage.sourceUri.uri, stampImageUrl(BASE, stampData()))
  assert.equal(object.heroImage.contentDescription.defaultValue.value, '3 de 6 sellos')
  assert.equal(
    buildObjectPatch(stampData(), true, BASE).heroImage?.sourceUri.uri,
    object.heroImage.sourceUri.uri,
  )
  assert.equal('heroImage' in buildLoyaltyObject('3388000000012345678', stampData()), false)
  assert.equal('heroImage' in buildLoyaltyObject('3388000000012345678', passData(), BASE), false)
})

Deno.test('Apple: stamp cards move the balance to the header and add strip images', async () => {
  const options = {
    passTypeId: 'pass.com.example.test',
    teamId: 'TEAMID1234',
    webServiceUrl: 'https://demo-ref.supabase.co/functions/v1/wallet/apple',
    authenticationToken: 'a'.repeat(64),
  }
  const pass = buildPassJson(stampData(), options)
  assert.equal(pass.storeCard.headerFields[0].value, 3)
  assert.deepEqual(pass.storeCard.primaryFields, [])
  assert.deepEqual(buildPassJson(passData(), options).storeCard.headerFields, [])

  const logoPng = await encodePng(solid(8, 8, [0, 0, 0, 255]))
  const deps = {
    config: { supabaseUrl: 'https://demo-ref.supabase.co' },
    fetch: (() => Promise.resolve(new Response(logoPng))) as typeof fetch,
    log: () => {},
  }
  const images = await passImages(deps, stampData())
  assert.deepEqual(ihdrSize(images['strip.png']), [375, 144])
  assert.deepEqual(ihdrSize(images['strip@2x.png']), [750, 288])
  assert.ok(images['logo.png'])
  assert.equal('strip.png' in (await passImages(deps, passData())), false)
})

// --- GET /wallet/stamps.png -----------------------------------------------------------

function stampRequest(query: string, method = 'GET') {
  return new Request(`${BASE}?${query}`, { method })
}

Deno.test('GET /stamps.png renders the image with an immutable cache', async () => {
  clearStampCache()
  const rpc = fakeRpc({
    wallet_stamp_brand: ({ p_business_id }) =>
      p_business_id === BIZ ? { primaryColor: '#ff8800', logoPath: null } : null,
  })
  const handler = createHandler({ env: BASE_ENV, rpc, log: () => {} })
  const v = brandVersion(null, '#ff8800')
  const res = await handler(stampRequest(`b=${BIZ}&n=2&t=3&v=${v}`))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'image/png')
  assert.equal(res.headers.get('Cache-Control'), IMMUTABLE)
  assert.deepEqual(ihdrSize(new Uint8Array(await res.arrayBuffer())), [1032, 336])

  const old = await handler(stampRequest(`b=${BIZ}&n=2&t=3&v=00000000`))
  assert.equal(old.status, 200)
  assert.equal(
    old.headers.get('Cache-Control'),
    SHORT_CACHE,
    'an old brand version is not cached long',
  )
  await old.body?.cancel()
})

Deno.test('GET /stamps.png validates params and the loyalty module', async () => {
  clearStampCache()
  const rpc = fakeRpc({ wallet_stamp_brand: () => null })
  const handler = createHandler({ env: BASE_ENV, rpc, log: () => {} })
  const bad = await handler(stampRequest(`b=${BIZ}&n=4&t=21&v=0a1b2c3d`))
  assert.equal(bad.status, 400)
  await bad.body?.cancel()
  assert.equal(rpc.calls.length, 0, 'bad params never reach the database')
  const missing = await handler(stampRequest(`b=${BIZ}&n=1&t=3&v=0a1b2c3d`))
  assert.equal(missing.status, 404, 'a business without the loyalty module gets nothing')
  await missing.body?.cancel()
  const post = await handler(stampRequest(`b=${BIZ}&n=1&t=3&v=0a1b2c3d`, 'POST'))
  assert.equal(post.status, 405)
  await post.body?.cancel()
  const unconfigured = createHandler({ env: {}, log: () => {} })
  const res = await unconfigured(stampRequest(`b=${BIZ}&n=1&t=3&v=0a1b2c3d`))
  assert.equal(res.status, 501)
  await res.body?.cancel()
})

Deno.test(
  'GET /stamps.png: if the PNG logo fails to load, the check is served briefly',
  async () => {
    clearStampCache()
    const rpc = fakeRpc({
      wallet_stamp_brand: () => ({ primaryColor: '#ff8800', logoPath: `${BIZ}/logo-1.png` }),
    })
    const fetchFn = (() => Promise.resolve(new Response('nope', { status: 503 }))) as typeof fetch
    const handler = createHandler({ env: BASE_ENV, rpc, fetch: fetchFn, log: () => {} })
    const v = brandVersion(`${BIZ}/logo-1.png`, '#ff8800')
    const res = await handler(stampRequest(`b=${BIZ}&n=1&t=3&v=${v}`))
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('Cache-Control'), SHORT_CACHE)
    await res.body?.cancel()
  },
)
