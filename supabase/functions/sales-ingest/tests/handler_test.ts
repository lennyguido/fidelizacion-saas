// Pruebas de `sales-ingest` sin red ni base: la base se reemplaza por un doble.
import assert from 'node:assert/strict'
import { createHandler, sha256Hex, type Rpc } from '../handler.ts'
import { keyFromHeaders, normalizePhone, parseSale } from '../sale.ts'

const KEY = 'lk_' + '0123456789abcdef'.repeat(2) + '01234567'

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/sales-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function fakeRpc(result: unknown, memberCustomer: string | null = null) {
  const calls: { schema: string; fn: string; args: Record<string, unknown> }[] = []
  const rpc: Rpc = (schema, fn, args) => {
    calls.push({ schema, fn, args })
    return Promise.resolve(fn === 'integration_member_customer' ? memberCustomer : result)
  }
  return { rpc, calls }
}

Deno.test('normalizes Argentine phones', () => {
  assert.deepEqual(normalizePhone('11 2233-4455'), '+5491122334455')
  assert.deepEqual(normalizePhone('+54 9 11 2233-4455'), '+5491122334455')
  assert.deepEqual(normalizePhone('5491122334455'), '+5491122334455')
  assert.deepEqual(normalizePhone('123'), null)
  assert.deepEqual(normalizePhone(42), null)
})

Deno.test('reads the key from Authorization or X-Api-Key', () => {
  assert.deepEqual(keyFromHeaders(new Headers({ Authorization: `Bearer ${KEY}` })), KEY)
  assert.deepEqual(keyFromHeaders(new Headers({ 'X-Api-Key': KEY })), KEY)
  assert.deepEqual(keyFromHeaders(new Headers({ Authorization: 'Bearer nope' })), null)
})

Deno.test('parses amounts in pesos or cents', () => {
  const pesos = parseSale({ receipt: 'A-1', amount: 8500.5 })
  assert.deepEqual('error' in pesos ? null : pesos.amountMinor, 850050)
  const cents = parseSale({ receipt: 'A-1', amount_minor: 1200 })
  assert.deepEqual('error' in cents ? null : cents.amountMinor, 1200)
  assert.deepEqual(parseSale({ receipt: '', amount: 1 }), { error: 'receipt is required' })
  assert.deepEqual(parseSale({ receipt: 'A-1', amount: -5 }), { error: 'invalid amount' })
})

Deno.test('rejects requests without a valid key', async () => {
  const { rpc, calls } = fakeRpc({ status: 'created' })
  const handler = createHandler({ env: {}, rpc })
  const res = await handler(request({ receipt: 'A-1' }, { Authorization: '' }))
  assert.deepEqual(res.status, 401)
  assert.deepEqual(calls.length, 0)
})

Deno.test('sends the key hash and normalized sale to the database', async () => {
  const { rpc, calls } = fakeRpc({ status: 'created', visitId: 'v1', identified: true }, 'c1')
  const handler = createHandler({ env: {}, rpc })
  const res = await handler(
    request({ receipt: ' FAC-1 ', amount: 100, phone: '11 2233-4455', member_code: 'abcd2345' }),
  )
  assert.deepEqual(res.status, 201)
  assert.deepEqual(await res.json(), { status: 'created', visitId: 'v1', identified: true })
  const hash = await sha256Hex(KEY)
  assert.deepEqual(calls[0], {
    schema: 'loyalty',
    fn: 'integration_member_customer',
    args: { p_key_hash: hash, p_code: 'ABCD2345' },
  })
  assert.deepEqual(calls[1]?.args, {
    p_key_hash: hash,
    p_receipt: 'FAC-1',
    p_amount_minor: 10000,
    p_occurred_at: null,
    p_phone: '+5491122334455',
    p_customer_id: 'c1',
  })
})

Deno.test('maps database answers to HTTP statuses', async () => {
  for (const [status, http] of [
    ['duplicate', 200],
    ['unauthorized', 401],
    ['invalid', 400],
  ] as const) {
    const handler = createHandler({ env: {}, rpc: fakeRpc({ status }).rpc })
    assert.deepEqual((await handler(request({ receipt: 'A-1' }))).status, http)
  }
})

Deno.test('answers 501 without configuration and 405 for GET', async () => {
  assert.deepEqual((await createHandler({ env: {} })(request({ receipt: 'A-1' }))).status, 501)
  const get = new Request('http://localhost/sales-ingest', { method: 'GET' })
  assert.deepEqual((await createHandler({ env: {}, rpc: fakeRpc(null).rpc })(get)).status, 405)
})
