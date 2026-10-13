// Pruebas de `calendar` sin red.
import assert from 'node:assert/strict'
import { buildIcs, createHandler } from '../handler.ts'

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' }
const TOKEN = 'a'.repeat(40)
const row = {
  id: '11111111-2222-4333-8444-555555555555',
  starts_at: '2026-10-16T13:00:00Z',
  ends_at: '2026-10-16T13:40:00Z',
  status: 'booked',
  service_name: 'Corte, barba',
  customer_name: 'Ana Gómez',
  customer_phone: '+5491155550001',
  staff_name: 'Juan',
  business_name: 'Barbería Sol',
}

function fakeFetch(status: number, body: unknown) {
  const calls: string[] = []
  const fn = (input: string | URL | Request) => {
    calls.push(String(input))
    return Promise.resolve(new Response(JSON.stringify(body), { status }))
  }
  return { fn: fn as typeof fetch, calls }
}

Deno.test('builds a calendar with the appointments', async () => {
  const { fn } = fakeFetch(200, [row])
  const res = await createHandler({ env, fetch: fn, now: () => new Date('2026-10-13T00:00:00Z') })(
    new Request(`https://x/calendar/${TOKEN}.ics`),
  )
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'text/calendar; charset=utf-8')
  const text = await res.text()
  assert.ok(text.includes('DTSTART:20261016T130000Z'))
  assert.ok(text.includes('SUMMARY:Ana Gómez · Corte\\, barba'))
  assert.ok(text.includes('UID:11111111-2222-4333-8444-555555555555@turnos.neriva.net'))
})

Deno.test('bad tokens are not found and never reach the database', async () => {
  const { fn, calls } = fakeFetch(200, [])
  const res = await createHandler({ env, fetch: fn })(new Request('https://x/calendar/abc.ics'))
  assert.equal(res.status, 404)
  assert.equal(calls.length, 0)
})

Deno.test('an empty calendar is still valid', () => {
  const ics = buildIcs([], new Date('2026-10-13T00:00:00Z'), 'Mis turnos')
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'))
  assert.ok(ics.trim().endsWith('END:VCALENDAR'))
})

Deno.test('escapes commas and semicolons in text', () => {
  const ics = buildIcs([{ ...row, service_name: 'Corte; barba, cejas' }], new Date(), 'X')
  assert.ok(ics.includes('Corte\; barba\\, cejas'))
})
