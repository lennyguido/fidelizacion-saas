// Pruebas de `send-email` sin red.
import assert from 'node:assert/strict'
import { bookingConfirmation, createHandler } from '../handler.ts'

const TOKEN = 'b'.repeat(64)
const payload = {
  link: `https://turnos.neriva.net/turno#${TOKEN}`,
  startsAt: '2026-10-16T18:30:00Z',
  timezone: 'America/Argentina/Buenos_Aires',
  businessName: 'Barbería <Sol>',
  serviceName: 'Corte',
  staffName: 'Juan',
  customerName: 'Ana Gómez',
  color: '#123456',
}

Deno.test('builds the confirmation in the business time zone, escaped', () => {
  const email = bookingConfirmation(payload)
  assert.ok(email)
  assert.match(email.subject, /15:30/, email.subject)
  assert.ok(email.html.includes('Barbería &lt;Sol&gt;'), 'business name is escaped')
  assert.ok(!email.html.includes('<Sol>'), 'no raw html from data')
  assert.ok(email.html.includes('#123456'), 'uses the business color')
  assert.match(email.text, /¡Hola Ana!/, email.text)
})

Deno.test('refuses links that are not ours', () => {
  assert.equal(bookingConfirmation({ ...payload, link: 'https://evil.example/x' }), null)
})

Deno.test('without the provider key it sends nothing', async () => {
  let called = false
  const res = await createHandler({
    env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    fetch: (() => {
      called = true
      return Promise.resolve(new Response('[]'))
    }) as typeof fetch,
  })(new Request('https://x/send-email', { method: 'POST' }))
  assert.deepEqual(await res.json(), { configured: false })
  assert.equal(called, false)
})

Deno.test('sends queued emails and reports the result', async () => {
  const calls: string[] = []
  const fakeFetch = ((input: string | URL | Request) => {
    const u = String(input)
    calls.push(u)
    if (u.endsWith('/email_batch')) {
      return Promise.resolve(
        new Response(
          JSON.stringify([{ id: '1', kind: 'booking_confirmation', to_email: 'a@b.co', payload }]),
        ),
      )
    }
    return Promise.resolve(new Response('{}', { status: u.includes('brevo') ? 201 : 200 }))
  }) as typeof fetch
  const res = await createHandler({
    env: {
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
      BREVO_API_KEY: 'x',
    },
    fetch: fakeFetch,
  })(new Request('https://x/send-email', { method: 'POST' }))
  assert.deepEqual(await res.json(), { configured: true, sent: 1, failed: 0 })
  assert.ok(calls.some((c) => c.includes('api.brevo.com')))
  assert.ok(calls.at(-1)?.endsWith('/email_result'))
})
