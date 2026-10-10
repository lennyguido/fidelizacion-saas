import assert from 'node:assert/strict'
import { applePassToken, buildPkpass } from '../apple/handlers.ts'
import { buildManifest, buildPassJson, sha1Hex } from '../apple/pass.ts'
import { solidPng } from '../apple/png.ts'
import { crc32, zipStored } from '../apple/zip.ts'
import { passData } from './helpers.ts'

const OPTIONS = {
  passTypeId: 'pass.com.example.test',
  teamId: 'TEAMID1234',
  webServiceUrl: 'https://demo-ref.supabase.co/functions/v1/wallet/apple',
  authenticationToken: 'a'.repeat(64),
}

Deno.test('pass.json is a storeCard with balance, QR and web service', () => {
  const pass = buildPassJson(passData(), OPTIONS)
  assert.equal(pass.formatVersion, 1)
  assert.equal(pass.passTypeIdentifier, 'pass.com.example.test')
  assert.equal(pass.teamIdentifier, 'TEAMID1234')
  assert.equal(pass.serialNumber, 'abcdef0123456789abcdef0123456789')
  assert.equal(pass.webServiceURL, OPTIONS.webServiceUrl)
  assert.equal(pass.authenticationToken, OPTIONS.authenticationToken)
  assert.equal(pass.backgroundColor, 'rgb(255, 136, 0)')
  assert.equal(pass.storeCard.primaryFields[0].value, 7)
  assert.equal(pass.storeCard.secondaryFields[0].value, 'Rosa')
  assert.deepEqual(pass.barcodes[0], {
    format: 'PKBarcodeFormatQR',
    message: 'ABCD2345',
    messageEncoding: 'iso-8859-1',
    altText: 'ABCD2345',
  })
  assert.equal('voided' in pass, false)
})

Deno.test('an inactive pass is voided and has no name', () => {
  const pass = buildPassJson(passData({ active: false, firstName: null }), OPTIONS)
  assert.equal(pass.voided, true)
  assert.deepEqual(pass.storeCard.secondaryFields, [])
})

Deno.test('manifest lists the SHA-1 of every file', async () => {
  assert.equal(
    await sha1Hex(new TextEncoder().encode('abc')),
    'a9993e364706816aba3e25717850c26c9cd0d89d',
  )
  const manifest = await buildManifest({
    'pass.json': new TextEncoder().encode('abc'),
    'icon.png': new Uint8Array(),
  })
  assert.deepEqual(manifest, {
    'icon.png': 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    'pass.json': 'a9993e364706816aba3e25717850c26c9cd0d89d',
  })
})

Deno.test('crc32 and the stored zip', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
  const zip = zipStored({ 'a.txt': new TextEncoder().encode('hola') })
  assert.deepEqual(Array.from(zip.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04])
  assert.deepEqual(Array.from(zip.slice(-22, -18)), [0x50, 0x4b, 0x05, 0x06])
  assert.ok(new TextDecoder().decode(zip).includes('hola'))
})

Deno.test('solidPng builds a valid PNG header', async () => {
  const png = await solidPng(29, 29, '#ff8800')
  assert.deepEqual(Array.from(png.slice(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(new DataView(png.buffer).getUint32(16), 29)
})

Deno.test('buildPkpass signs exactly the manifest and zips everything', async () => {
  let signed: string | null = null
  const zip = await buildPkpass(
    passData(),
    OPTIONS,
    {
      webServiceUrl: OPTIONS.webServiceUrl,
      authenticationToken: OPTIONS.authenticationToken,
      images: { 'icon.png': new Uint8Array([1, 2, 3]) },
    },
    (manifest) => {
      signed = new TextDecoder().decode(manifest)
      return new TextEncoder().encode('SIGNATURE')
    },
  )
  const text = new TextDecoder().decode(zip)
  for (const name of ['pass.json', 'icon.png', 'manifest.json', 'signature']) {
    assert.ok(text.includes(name), `zip has ${name}`)
  }
  const manifest = JSON.parse(signed ?? '{}') as Record<string, string>
  assert.deepEqual(Object.keys(manifest).sort(), ['icon.png', 'pass.json'])
  assert.equal(manifest['icon.png'], await sha1Hex(new Uint8Array([1, 2, 3])))
})

Deno.test('ApplePass authorization header', () => {
  const req = (value: string) => new Request('https://x', { headers: { Authorization: value } })
  assert.equal(applePassToken(req(`ApplePass ${'b'.repeat(32)}`)), 'b'.repeat(32))
  assert.equal(applePassToken(req('ApplePass short')), null)
  assert.equal(applePassToken(req(`Bearer ${'b'.repeat(32)}`)), null)
})
