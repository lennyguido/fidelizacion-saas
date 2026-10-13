// Edge Function `calendar` (D-051): arma el archivo iCal (.ics) con los turnos de un
// profesional para suscribirse desde Google Calendar, el iPhone u Outlook.

export type Env = Record<string, string | undefined>

export interface HandlerDeps {
  env: Env
  fetch?: typeof fetch
  now?: () => Date
}

interface EventRow {
  id: string
  starts_at: string
  ends_at: string
  status: string
  service_name: string
  customer_name: string
  customer_phone: string | null
  staff_name: string
  business_name: string
}

const TOKEN = /^[0-9a-f]{40}$/

function icsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** Escapa texto para iCal (RFC 5545 §3.3.11). */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Corta líneas largas a 75 octetos (aprox. por caracteres), como pide iCal. */
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ' ' + rest.slice(74)
  }
  out.push(rest)
  return out.join('\r\n')
}

export function buildIcs(rows: EventRow[], now: Date, calendarName: string): string {
  const stamp = icsDate(now.toISOString())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neriva//Turnos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ]
  for (const row of rows) {
    const details = [row.service_name, row.customer_phone ? `Tel: ${row.customer_phone}` : null]
      .filter(Boolean)
      .join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${row.id}@turnos.neriva.net`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(row.starts_at)}`,
      `DTEND:${icsDate(row.ends_at)}`,
      `SUMMARY:${esc(`${row.customer_name} · ${row.service_name}`)}`,
      `DESCRIPTION:${esc(details)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const { SUPABASE_URL: url } = deps.env
  const serviceKey = deps.env.SUPABASE_SERVICE_ROLE_KEY
  const fetchFn = deps.fetch ?? fetch
  const now = deps.now ?? (() => new Date())

  return async (req) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405 })
    }
    const last = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''
    const token = last.replace(/\.ics$/, '')
    if (!TOKEN.test(token)) return new Response('not found', { status: 404 })
    if (!url || !serviceKey) return new Response('not configured', { status: 501 })

    const headers: Record<string, string> = {
      apikey: serviceKey,
      'Content-Type': 'application/json',
      'Content-Profile': 'booking',
    }
    if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`
    const res = await fetchFn(`${url}/rest/v1/rpc/calendar_events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_token: token }),
    })
    if (!res.ok) return new Response('error', { status: 502 })
    const rows = (await res.json()) as EventRow[]
    const name = rows[0] ? `Turnos ${rows[0].staff_name} · ${rows[0].business_name}` : 'Mis turnos'
    return new Response(buildIcs(rows, now(), name), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': 'inline; filename="turnos.ics"',
      },
    })
  }
}
