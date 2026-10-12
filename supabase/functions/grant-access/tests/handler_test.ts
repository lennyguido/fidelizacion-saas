// Pruebas de `grant-access` sin red: fetch se reemplaza por un doble.
import assert from 'node:assert/strict'
import { createHandler } from '../handler.ts'

const env = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
  PANEL_URL: 'https://panel.neriva.net',
}

function fakeFetch(grantStatus: number, inviteStatus: number) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init: init ?? {} })
    const status = url.includes('/rpc/create_access_grant') ? grantStatus : inviteStatus
    return Promise.resolve(new Response('{}', { status }))
  }
  return { fn: fn as typeof fetch, calls }
}

function request(body: unknown, auth = 'Bearer user-jwt'): Request {
  return new Request('http://localhost/grant-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  })
}

Deno.test('creates the grant with the caller session and sends the invitation', async () => {
  const { fn, calls } = fakeFetch(200, 200)
  const res = await createHandler({ env, fetch: fn })(
    request({ email: ' Ana@Cafe.com ', plan: 'barrio' }),
  )
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { status: 'invited', email: 'ana@cafe.com', plan: 'barrio' })
  assert.equal((calls[0]?.init.headers as Record<string, string>).Authorization, 'Bearer user-jwt')
  assert.ok(calls[1]?.url.startsWith('https://x.supabase.co/auth/v1/invite?redirect_to='))
  assert.ok(calls[1]?.url.includes(encodeURIComponent('https://panel.neriva.net/reset-password')))
})

Deno.test('refuses callers that are not platform admins', async () => {
  const { fn, calls } = fakeFetch(403, 200)
  const res = await createHandler({ env, fetch: fn })(request({ email: 'a@b.co', plan: 'local' }))
  assert.equal(res.status, 403)
  assert.equal(calls.length, 1)
})

Deno.test('an existing account does not need an invitation', async () => {
  const { fn } = fakeFetch(200, 422)
  const res = await createHandler({ env, fetch: fn })(request({ email: 'a@b.co', plan: 'local' }))
  assert.equal((await res.json()).status, 'existing_user')
})

Deno.test('validates input and session', async () => {
  const handler = createHandler({ env, fetch: fakeFetch(200, 200).fn })
  assert.equal((await handler(request({ email: 'nope', plan: 'barrio' }))).status, 400)
  assert.equal((await handler(request({ email: 'a@b.co', plan: 'oro' }))).status, 400)
  assert.equal((await handler(request({ email: 'a@b.co', plan: 'barrio' }, ''))).status, 401)
  assert.equal((await createHandler({ env: {} })(request({}))).status, 501)
})
