// Pruebas de `team-invite` sin red: fetch se reemplaza por un doble.
import assert from 'node:assert/strict'
import { createHandler } from '../handler.ts'

const env = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
  PANEL_URL: 'https://panel.neriva.net',
}
const ID = '11111111-2222-4333-8444-555555555555'
const TOKEN = 'a'.repeat(64)

function fakeFetch(readStatus: number, rows: unknown[], inviteStatus: number) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init: init ?? {} })
    if (url.includes('/rest/v1/invitations'))
      return Promise.resolve(new Response(JSON.stringify(rows), { status: readStatus }))
    return Promise.resolve(new Response('{}', { status: inviteStatus }))
  }
  return { fn: fn as typeof fetch, calls }
}

function request(body: unknown, auth = 'Bearer user-jwt'): Request {
  return new Request('http://localhost/team-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  })
}

Deno.test('reads the invitation with the caller session and sends the email', async () => {
  const { fn, calls } = fakeFetch(200, [{ email: 'ana@cafe.com' }], 200)
  const res = await createHandler({ env, fetch: fn })(request({ invitationId: ID, token: TOKEN }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { status: 'invited', email: 'ana@cafe.com' })
  assert.equal((calls[0]?.init.headers as Record<string, string>).Authorization, 'Bearer user-jwt')
  assert.equal(JSON.parse(String(calls[1]?.init.body)).email, 'ana@cafe.com')
  const redirect = decodeURIComponent(calls[1]!.url.split('redirect_to=')[1]!)
  assert.equal(
    redirect,
    `https://panel.neriva.net/reset-password?next=${encodeURIComponent(`/invitacion/${TOKEN}`)}`,
  )
})

Deno.test('an invitation the caller cannot see is not sent', async () => {
  const { fn, calls } = fakeFetch(200, [], 200)
  const res = await createHandler({ env, fetch: fn })(request({ invitationId: ID, token: TOKEN }))
  assert.equal(res.status, 404)
  assert.equal(calls.length, 1)
})

Deno.test('an existing account does not need the email', async () => {
  const { fn } = fakeFetch(200, [{ email: 'a@b.co' }], 422)
  const res = await createHandler({ env, fetch: fn })(request({ invitationId: ID, token: TOKEN }))
  assert.equal((await res.json()).status, 'existing_user')
})

Deno.test('validates input and session', async () => {
  const handler = createHandler({ env, fetch: fakeFetch(200, [], 200).fn })
  assert.equal((await handler(request({ invitationId: 'x', token: TOKEN }))).status, 400)
  assert.equal((await handler(request({ invitationId: ID, token: 'bad token' }))).status, 400)
  assert.equal((await handler(request({ invitationId: ID, token: TOKEN }, ''))).status, 401)
  assert.equal((await createHandler({ env: {} })(request({}))).status, 501)
})
