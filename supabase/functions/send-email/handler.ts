// Edge Function `send-email` (D-055): toma mails pendientes de core.email_outbox,
// los arma y los manda con Brevo. Solo funciones del núcleo con service_role.

export type Env = Record<string, string | undefined>

export interface HandlerDeps {
  env: Env
  fetch?: typeof fetch
}

interface OutboxRow {
  id: string
  kind: string
  to_email: string
  payload: Record<string, unknown> | null
}

interface Email {
  subject: string
  html: string
  text: string
  senderName: string
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function brand(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#b0175a'
}

/** "jueves 16 de octubre · 15:30" en la hora del negocio. */
export function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('es-AR', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  const time = new Intl.DateTimeFormat('es-AR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return `${day} · ${time}`
}

export function bookingConfirmation(p: Record<string, unknown>): Email | null {
  const link = str(p.link)
  const startsAt = str(p.startsAt)
  if (!/^https:\/\/turnos\.neriva\.net\/turno#[0-9a-f]{64}$/.test(link) || !startsAt) return null
  const business = str(p.businessName) || 'Tu turno'
  const when = formatWhen(startsAt, str(p.timezone) || 'America/Argentina/Buenos_Aires')
  const first = str(p.customerName).trim().split(/\s+/)[0] ?? ''
  const what = `${str(p.serviceName)} con ${str(p.staffName)}`
  const color = brand(p.color)
  const note = str(p.message)

  const text = [
    `¡Hola${first ? ` ${first}` : ''}! Tu turno en ${business} está confirmado.`,
    '',
    when,
    what,
    note,
    '',
    `Para verlo, cambiarlo o cancelarlo: ${link}`,
  ]
    .filter((l, i, all) => l !== '' || all[i - 1] !== '')
    .join('\n')

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f3f7;font-family:Arial,Helvetica,sans-serif;color:#1e1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:${color};padding:28px 28px 24px;color:#ffffff">
<p style="margin:0;font-size:14px;opacity:.85">Turno confirmado en</p>
<p style="margin:4px 0 0;font-size:28px;font-weight:bold;line-height:1.1">${esc(business)}</p>
</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px">¡Hola${first ? ` ${esc(first)}` : ''}! Te esperamos:</p>
<p style="margin:0;font-size:20px;font-weight:bold">${esc(when)}</p>
<p style="margin:4px 0 0;font-size:16px">${esc(what)}</p>
${note ? `<p style="margin:16px 0 0;font-size:14px;color:#5b5870">${esc(note)}</p>` : ''}
<p style="margin:28px 0 8px"><a href="${esc(link)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:999px">Ver, cambiar o cancelar</a></p>
<p style="margin:0;font-size:12px;color:#8a8799">Este link es solo tuyo: no lo compartas.</p>
</td></tr></table>
<p style="font-size:12px;color:#8a8799;margin:16px 0 0">Reservado con Neriva Turnos</p>
</td></tr></table></body></html>`

  return { subject: `Tu turno en ${business}: ${when}`, html, text, senderName: business }
}

export function render(row: OutboxRow): Email | null {
  if (!row.payload) return null
  if (row.kind === 'booking_confirmation') return bookingConfirmation(row.payload)
  return null
}

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const url = deps.env.SUPABASE_URL
  const serviceKey = deps.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = deps.env.BREVO_API_KEY
  const from = deps.env.EMAIL_FROM || 'turnos@neriva.net'
  const fetchFn = deps.fetch ?? fetch

  return async (req) => {
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
    if (!url || !serviceKey || !apiKey) {
      return new Response(JSON.stringify({ configured: false }), { headers: JSON_HEADERS })
    }
    const headers: Record<string, string> = {
      apikey: serviceKey,
      'Content-Type': 'application/json',
      'Content-Profile': 'core',
    }
    if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`
    const rpc = (name: string, body: unknown) =>
      fetchFn(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) })

    const batch = await rpc('email_batch', { p_limit: 20 })
    if (!batch.ok) return new Response('error', { status: 502 })
    const rows = (await batch.json()) as OutboxRow[]

    let sent = 0
    let failed = 0
    for (const row of rows) {
      const email = render(row)
      let ok = false
      let error: string | null = 'cannot render'
      if (email) {
        const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            sender: { name: email.senderName.slice(0, 70), email: from },
            to: [{ email: row.to_email }],
            subject: email.subject,
            htmlContent: email.html,
            textContent: email.text,
          }),
        })
        ok = res.ok
        error = ok ? null : `brevo ${res.status}`
      }
      await rpc('email_result', { p_id: row.id, p_ok: ok, p_error: error })
      if (ok) sent++
      else failed++
    }
    return new Response(JSON.stringify({ configured: true, sent, failed }), {
      headers: JSON_HEADERS,
    })
  }
}
