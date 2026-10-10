import assert from 'node:assert/strict'
import { createGoogleApi } from '../google/api.ts'
import { importRsaPrivateKey, base64url, signJwt } from '../google/jwt.ts'
import {
  buildLoyaltyClass,
  buildLoyaltyObject,
  buildObjectPatch,
  classIdFor,
  objectIdFor,
  saveJwtClaims,
} from '../google/objects.ts'
import { decodeJwtPart, passData, rsaKeyPair } from './helpers.ts'

const ISSUER = '3388000000012345678'

Deno.test('class and object ids use only allowed characters', () => {
  assert.equal(
    classIdFor(ISSUER, '22222222-2222-2222-2222-222222222222'),
    `${ISSUER}.biz_22222222222222222222222222222222`,
  )
  assert.equal(objectIdFor(ISSUER, 'ab.c/d_e-f'), `${ISSUER}.abcd_e-f`)
})

Deno.test('LoyaltyClass carries the business name, logo and color', () => {
  const klass = buildLoyaltyClass(ISSUER, passData(), 'https://x/logo.png')
  assert.equal(klass.programName, 'Café Central')
  assert.equal(klass.issuerName, 'Café Central')
  assert.equal(klass.programLogo.sourceUri.uri, 'https://x/logo.png')
  assert.equal(klass.hexBackgroundColor, '#ff8800')
  assert.equal(klass.reviewStatus, 'UNDER_REVIEW')
})

Deno.test('LoyaltyObject: balance, QR with the member code, next reward; no personal data', () => {
  const object = buildLoyaltyObject(ISSUER, passData())
  assert.equal(object.id, `${ISSUER}.abcdef0123456789abcdef0123456789`)
  assert.equal(object.classId, `${ISSUER}.biz_22222222222222222222222222222222`)
  assert.equal(object.state, 'ACTIVE')
  assert.deepEqual(object.loyaltyPoints, { label: 'Puntos', balance: { int: 7 } })
  assert.deepEqual(object.barcode, {
    type: 'QR_CODE',
    value: 'ABCD2345',
    alternateText: 'ABCD2345',
  })
  assert.equal(object.accountName, 'Rosa')
  assert.match(object.textModulesData[0].body, /Café gratis/)
  assert.doesNotMatch(JSON.stringify(object), /@|\+54|phone|email/i)
})

Deno.test('an inactive pass shows no name and state INACTIVE', () => {
  const object = buildLoyaltyObject(ISSUER, passData({ active: false, firstName: null }))
  assert.equal(object.state, 'INACTIVE')
  assert.equal(object.accountName, '')
})

Deno.test('sync patch asks Google to notify only when wanted', () => {
  assert.equal(buildObjectPatch(passData(), true).notifyPreference, 'notifyOnUpdate')
  assert.equal('notifyPreference' in buildObjectPatch(passData(), false), false)
  assert.equal('id' in buildObjectPatch(passData(), true), false)
})

Deno.test('save JWT claims follow the "savetowallet" format', () => {
  const claims = saveJwtClaims(
    'sa@x.iam.gserviceaccount.com',
    ISSUER,
    passData(),
    ['https://a.app'],
    100,
  )
  assert.equal(claims.aud, 'google')
  assert.equal(claims.typ, 'savetowallet')
  assert.equal(claims.iss, 'sa@x.iam.gserviceaccount.com')
  assert.deepEqual(claims.origins, ['https://a.app'])
  assert.deepEqual(claims.payload.loyaltyObjects, [
    {
      id: `${ISSUER}.abcdef0123456789abcdef0123456789`,
      classId: `${ISSUER}.biz_22222222222222222222222222222222`,
    },
  ])
})

Deno.test('signJwt produces a valid RS256 signature', async () => {
  const { privateKeyPem, publicKey } = await rsaKeyPair()
  const jwt = await signJwt({ hello: 'mundo' }, await importRsaPrivateKey(privateKeyPem))
  const [header, payload, signature] = jwt.split('.')
  assert.deepEqual(decodeJwtPart(header), { alg: 'RS256', typ: 'JWT' })
  assert.deepEqual(decodeJwtPart(payload), { hello: 'mundo' })
  const sig = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  )
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    sig,
    new TextEncoder().encode(`${header}.${payload}`),
  )
  assert.ok(ok)
  assert.equal(base64url(new Uint8Array([251, 255])), '-_8')
})

function fakeGoogle(responses: Record<string, number[]>) {
  const calls: string[] = []
  const fetchFn = (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const key = `${init?.method ?? 'GET'} ${url.replace(/^https:\/\/[^/]+/, '')}`
    calls.push(key)
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return Promise.resolve(Response.json({ access_token: 'tok', expires_in: 3600 }))
    }
    const match = Object.keys(responses).find((k) => key.startsWith(k))
    const status = match ? (responses[match].shift() ?? 200) : 200
    return Promise.resolve(new Response(status === 204 ? null : '{}', { status }))
  }
  return { calls, fetchFn: fetchFn as typeof fetch }
}

async function api(responses: Record<string, number[]>) {
  const { privateKeyPem } = await rsaKeyPair()
  const fake = fakeGoogle(responses)
  return {
    ...fake,
    api: createGoogleApi(
      { issuerId: ISSUER, clientEmail: 'sa@x', privateKeyPem },
      { fetch: fake.fetchFn, sleep: () => Promise.resolve() },
    ),
  }
}

Deno.test('upsertClass inserts, and patches when the class already exists', async () => {
  const { api: google, calls } = await api({ 'POST /walletobjects/v1/loyaltyClass': [409] })
  await google.upsertClass(passData(), 'https://x/logo.png')
  assert.deepEqual(
    calls.filter((c) => c !== 'POST /token'),
    [
      'POST /walletobjects/v1/loyaltyClass',
      `PATCH /walletobjects/v1/loyaltyClass/${ISSUER}.biz_22222222222222222222222222222222`,
    ],
  )
  assert.equal(calls.filter((c) => c === 'POST /token').length, 1, 'the OAuth token is cached')
})

Deno.test('Google calls are retried on 503 and fail after that', async () => {
  const { api: google, calls } = await api({ 'PATCH /walletobjects/v1/loyaltyObject': [503, 200] })
  assert.equal(await google.patchObject(passData(), true), 'ok')
  assert.equal(calls.filter((c) => c.startsWith('PATCH')).length, 2)

  const failing = await api({ 'PATCH /walletobjects/v1/loyaltyObject': [500, 500, 500] })
  await assert.rejects(
    () => failing.api.patchObject(passData(), true),
    /patch object failed \(500\)/,
  )
})

Deno.test('patchObject reports a pass Google no longer has', async () => {
  const { api: google } = await api({ 'PATCH /walletobjects/v1/loyaltyObject': [404] })
  assert.equal(await google.patchObject(passData(), true), 'gone')
})
