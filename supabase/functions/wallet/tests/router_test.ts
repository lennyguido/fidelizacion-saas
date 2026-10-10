import assert from 'node:assert/strict'
import { createHandler, routeSegments } from '../router.ts'
import type { GoogleApi } from '../google/api.ts'
import { sha256Hex } from '../lib/db.ts'
import { APPLE_ENV, BASE_ENV, decodeJwtPart, fakeRpc, googleEnv, passData } from './helpers.ts'

const URL_BASE = 'https://demo-ref.supabase.co/functions/v1/wallet'
const TOKEN = 'c'.repeat(64)
const silent = () => {}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${URL_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function fakeGoogleApi() {
  const calls: string[] = []
  const api: GoogleApi = {
    accessToken: () => Promise.resolve('tok'),
    upsertClass: () => {
      calls.push('class')
      return Promise.resolve()
    },
    upsertObject: () => {
      calls.push('object')
      return Promise.resolve()
    },
    patchObject: (data) => {
      calls.push(`patch ${data.pointsBalance}`)
      return Promise.resolve('ok' as const)
    },
    addMessage: () => {
      calls.push('message')
      return Promise.resolve()
    },
  }
  return { api, calls }
}

Deno.test('routeSegments works with and without the /functions/v1 prefix', () => {
  assert.deepEqual(routeSegments('/wallet/google/sync'), ['google', 'sync'])
  assert.deepEqual(routeSegments('/functions/v1/wallet/status'), ['status'])
})

Deno.test('GET /status reports nothing configured without secrets', async () => {
  const handler = createHandler({ env: BASE_ENV, log: silent })
  const res = await handler(new Request(`${URL_BASE}/status`))
  assert.deepEqual(await res.json(), { google: false, apple: false })
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*')
})

Deno.test('without secrets Google and Apple answer 501 not_configured', async () => {
  const handler = createHandler({ env: BASE_ENV, log: silent })
  for (const path of ['/google', '/apple', '/google/sync']) {
    const res = await handler(post(path, { token: TOKEN }))
    assert.equal(res.status, 501, path)
    assert.deepEqual(await res.json(), { error: 'not_configured' })
  }
})

Deno.test('OPTIONS answers the CORS preflight', async () => {
  const handler = createHandler({ env: BASE_ENV, log: silent })
  const res = await handler(new Request(`${URL_BASE}/google`, { method: 'OPTIONS' }))
  assert.equal(res.status, 204)
  assert.match(res.headers.get('Access-Control-Allow-Headers') ?? '', /content-type/)
})

Deno.test('POST /google returns a Save to Google Wallet link', async () => {
  const { env, publicKey } = await googleEnv()
  const rpc = fakeRpc({ wallet_issue_pass: () => passData() })
  const google = fakeGoogleApi()
  const handler = createHandler({ env, rpc, googleApi: google.api, log: silent })

  const res = await handler(post('/google', { token: TOKEN }))
  assert.equal(res.status, 200)
  const { url } = (await res.json()) as { url: string }
  assert.ok(url.startsWith('https://pay.google.com/gp/v/save/'))
  const jwt = url.slice('https://pay.google.com/gp/v/save/'.length)
  const [header, payload, signature] = jwt.split('.')
  const claims = decodeJwtPart(payload) as {
    typ: string
    payload: { loyaltyObjects: { id: string }[] }
  }
  assert.equal(claims.typ, 'savetowallet')
  assert.equal(
    claims.payload.loyaltyObjects[0].id,
    '3388000000012345678.abcdef0123456789abcdef0123456789',
  )
  const sig = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  )
  assert.ok(
    await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      sig,
      new TextEncoder().encode(`${header}.${payload}`),
    ),
    'signed with the service account key',
  )
  assert.deepEqual(google.calls, ['class', 'object'])
  assert.deepEqual(rpc.calls[0], {
    fn: 'wallet_issue_pass',
    args: { p_card_token: TOKEN, p_provider: 'google' },
  })
})

Deno.test('POST /google validates the token, the card and the logo', async () => {
  const { env } = await googleEnv()
  const google = fakeGoogleApi()
  const missing = createHandler({
    env,
    rpc: fakeRpc({ wallet_issue_pass: () => null }),
    googleApi: google.api,
    log: silent,
  })
  assert.equal((await missing(post('/google', { token: 'nope' }))).status, 400)
  assert.equal((await missing(post('/google', { token: TOKEN }))).status, 404)

  const svgLogo = passData({ business: { name: 'X', primaryColor: null, logoPath: 'b/logo.svg' } })
  const noLogo = createHandler({
    env,
    rpc: fakeRpc({ wallet_issue_pass: () => svgLogo }),
    googleApi: google.api,
    log: silent,
  })
  const res = await noLogo(post('/google', { token: TOKEN }))
  assert.equal(res.status, 422)
  assert.deepEqual(await res.json(), { error: 'logo_required' })

  const withDefault = createHandler({
    env: { ...env, WALLET_DEFAULT_LOGO_URL: 'https://cdn.example/logo.png' },
    rpc: fakeRpc({ wallet_issue_pass: () => svgLogo }),
    googleApi: google.api,
    log: silent,
  })
  assert.equal((await withDefault(post('/google', { token: TOKEN }))).status, 200)
})

Deno.test('Google provider errors are not leaked to the client', async () => {
  const { env } = await googleEnv()
  const google = fakeGoogleApi()
  google.api.upsertClass = () => Promise.reject(new Error('secret detail'))
  const handler = createHandler({
    env,
    rpc: fakeRpc({ wallet_issue_pass: () => passData() }),
    googleApi: google.api,
    log: silent,
  })
  const res = await handler(post('/google', { token: TOKEN }))
  assert.equal(res.status, 502)
  assert.deepEqual(await res.json(), { error: 'provider_error' })
})

Deno.test('POST /google/sync needs the sync secret and drains the queue', async () => {
  const { env } = await googleEnv()
  const queue = [
    [
      { updateId: 1, revision: 1, attempts: 1, pass: passData({ pointsBalance: 8 }) },
      { updateId: 2, revision: 3, attempts: 1, pass: passData({ pointsBalance: 9 }) },
    ],
    [],
  ]
  const rpc = fakeRpc({
    wallet_claim_updates: () => queue.shift() ?? [],
    wallet_finish_update: () => 'done',
  })
  const google = fakeGoogleApi()
  const handler = createHandler({ env, rpc, googleApi: google.api, log: silent })

  assert.equal((await handler(post('/google/sync', {}))).status, 401)
  assert.equal(
    (await handler(post('/google/sync', {}, { 'x-wallet-sync-secret': 'wrong' }))).status,
    401,
  )

  const res = await handler(
    post('/google/sync', { limit: 2 }, { 'x-wallet-sync-secret': 'sync-secret-for-tests' }),
  )
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { processed: 2, done: 2, retry: 0, failed: 0, gone: 0 })
  assert.deepEqual(google.calls, ['patch 8', 'patch 9'])
  const finishes = rpc.calls.filter((c) => c.fn === 'wallet_finish_update').map((c) => c.args)
  assert.deepEqual(finishes, [
    { p_update_id: 1, p_revision: 1, p_error: null },
    { p_update_id: 2, p_revision: 3, p_error: null },
  ])
})

Deno.test('a failed Google update is reported back for retry', async () => {
  const { env } = await googleEnv()
  const rpc = fakeRpc({
    wallet_claim_updates: (() => {
      let first = true
      return () => {
        const batch = first ? [{ updateId: 5, revision: 1, attempts: 1, pass: passData() }] : []
        first = false
        return batch
      }
    })(),
    wallet_finish_update: () => 'retry',
  })
  const google = fakeGoogleApi()
  google.api.patchObject = () => Promise.reject(new Error('HTTP 500'))
  const handler = createHandler({ env, rpc, googleApi: google.api, log: silent })
  const res = await handler(
    post('/google/sync', {}, { 'x-wallet-sync-secret': 'sync-secret-for-tests' }),
  )
  assert.deepEqual(await res.json(), { processed: 1, done: 0, retry: 1, failed: 0, gone: 0 })
  const finish = rpc.calls.find((c) => c.fn === 'wallet_finish_update')
  assert.equal(finish?.args.p_error, 'HTTP 500')
})

Deno.test('status reports Apple only when all Apple secrets exist', async () => {
  const handler = createHandler({ env: APPLE_ENV, log: silent })
  assert.deepEqual(await (await handler(new Request(`${URL_BASE}/status`))).json(), {
    google: false,
    apple: true,
  })
  const partial = createHandler({ env: { ...APPLE_ENV, APPLE_WWDR_PEM: '' }, log: silent })
  assert.deepEqual(await (await partial(new Request(`${URL_BASE}/status`))).json(), {
    google: false,
    apple: false,
  })
})

Deno.test('POST /apple returns a download link and stores only the token hash', async () => {
  const rpc = fakeRpc({ wallet_issue_pass: () => passData({ provider: 'apple' }) })
  const handler = createHandler({
    env: APPLE_ENV,
    rpc,
    appleSigner: () => new Uint8Array(),
    log: silent,
  })
  const res = await handler(post('/apple', { token: TOKEN }))
  const { url } = (await res.json()) as { url: string }
  const auth = new URL(url).searchParams.get('auth') ?? ''
  assert.ok(url.startsWith(`${URL_BASE}/apple/download/abcdef0123456789abcdef0123456789?auth=`))
  assert.equal(rpc.calls[0].args.p_auth_token_hash, await sha256Hex(auth))
  assert.notEqual(rpc.calls[0].args.p_auth_token_hash, auth)
})

Deno.test('Apple download and web service', async () => {
  const auth = 'd'.repeat(64)
  const hash = await sha256Hex(auth)
  const rpc = fakeRpc({
    wallet_apple_pass: (args) =>
      args.p_auth_token_hash === hash ? passData({ provider: 'apple' }) : null,
    wallet_apple_register: (args) => (args.p_auth_token_hash === hash ? 'created' : 'unauthorized'),
    wallet_apple_unregister: (args) =>
      args.p_auth_token_hash === hash ? 'deleted' : 'unauthorized',
    wallet_apple_serials: () => ({ serialNumbers: [], lastUpdated: null }),
  })
  const handler = createHandler({
    env: APPLE_ENV,
    rpc,
    appleSigner: () => new TextEncoder().encode('SIG'),
    fetch: () => Promise.resolve(new Response(new Uint8Array([137, 80, 78, 71]))),
    log: silent,
  })
  const serial = 'abcdef0123456789abcdef0123456789'

  const download = await handler(new Request(`${URL_BASE}/apple/download/${serial}?auth=${auth}`))
  assert.equal(download.status, 200)
  assert.equal(download.headers.get('Content-Type'), 'application/vnd.apple.pkpass')
  await download.body?.cancel()
  assert.equal(
    (await handler(new Request(`${URL_BASE}/apple/download/${serial}?auth=${'e'.repeat(64)}`)))
      .status,
    404,
  )

  const reg = `${URL_BASE}/apple/v1/devices/device-1/registrations/pass.com.example.test/${serial}`
  const withAuth = (token: string, method: string, body?: unknown) =>
    new Request(reg, {
      method,
      headers: { Authorization: `ApplePass ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  assert.equal((await handler(withAuth(auth, 'POST', { pushToken: 'p' }))).status, 201)
  assert.equal((await handler(withAuth('f'.repeat(64), 'POST', { pushToken: 'p' }))).status, 401)
  assert.equal((await handler(new Request(reg, { method: 'POST', body: '{}' }))).status, 401)
  assert.equal((await handler(withAuth(auth, 'DELETE'))).status, 200)

  const serials = await handler(
    new Request(`${URL_BASE}/apple/v1/devices/device-1/registrations/pass.com.example.test`),
  )
  assert.equal(serials.status, 204)

  const latest = `${URL_BASE}/apple/v1/passes/pass.com.example.test/${serial}`
  const notModified = await handler(
    new Request(latest, {
      headers: {
        Authorization: `ApplePass ${auth}`,
        'If-Modified-Since': 'Sat, 10 Oct 2026 12:00:00 GMT',
      },
    }),
  )
  assert.equal(notModified.status, 304)
  const fresh = await handler(
    new Request(latest, { headers: { Authorization: `ApplePass ${auth}` } }),
  )
  assert.equal(fresh.status, 200)
  await fresh.body?.cancel()
  assert.equal((await handler(new Request(latest))).status, 401)
  assert.equal(
    (await handler(new Request(`${URL_BASE}/apple/v1/passes/pass.other/${serial}`))).status,
    404,
  )
  assert.equal((await handler(post('/apple/v1/log', { logs: ['hola'] }))).status, 200)
})
