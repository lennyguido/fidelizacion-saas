// Pruebas de `tap` sin red: fetch se reemplaza por un doble.
import assert from 'node:assert/strict'
import { createHandler } from '../handler.ts'

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' }

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return Promise.resolve(new Response(JSON.stringify(body), { status }))
  }
  return { fn: fn as typeof fetch, calls }
}

Deno.test('counts the tap and redirects to the destination', async () => {
  const { fn, calls } = fakeFetch(200, 'https://g.page/r/cafe/review')
  const res = await createHandler({ env, fetch: fn })(new Request('https://x/tap/abcd2345'))
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('Location'), 'https://g.page/r/cafe/review')
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { p_code: 'abcd2345', p_source: 'nfc' })
})

Deno.test('the printed QR is counted as qr', async () => {
  const { fn, calls } = fakeFetch(200, 'https://g.page/r/cafe/review')
  await createHandler({ env, fetch: fn })(new Request('https://x/tap/abcd2345?s=q'))
  assert.equal(JSON.parse(String(calls[0]?.init.body)).p_source, 'qr')
})

Deno.test('unknown or turned-off tags go to neriva.net', async () => {
  const { fn } = fakeFetch(200, null)
  const res = await createHandler({ env, fetch: fn })(new Request('https://x/tap/abcd2345'))
  assert.equal(res.headers.get('Location'), 'https://neriva.net')
})

Deno.test('bad codes and errors never show an error page', async () => {
  const { fn, calls } = fakeFetch(500, {})
  const handler = createHandler({ env, fetch: fn })
  assert.equal((await handler(new Request('https://x/tap/../etc'))).status, 302)
  assert.equal(calls.length, 0)
  const res = await handler(new Request('https://x/tap/abcd2345'))
  assert.equal(res.headers.get('Location'), 'https://neriva.net')
})
