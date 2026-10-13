// Edge Function `team-invite` (D-046): después de crear una invitación de equipo
// (core.create_invitation), el dueño o administrador pide mandarla por mail.
// Como el registro libre está apagado (D-043), es la forma de que una persona
// sin cuenta la cree: le llega el mail de Supabase Auth para elegir contraseña y
// después cae en /invitacion/<código> para aceptarla.
// Lo externo (secrets, fetch) llega por parámetro: se prueba sin red.

export type Env = Record<string, string | undefined>

export interface HandlerDeps {
  env: Env
  fetch?: typeof fetch
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) },
  })
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = deps.env
  const serviceKey = deps.env.SUPABASE_SERVICE_ROLE_KEY
  const fetchFn = deps.fetch ?? fetch

  return async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)
    if (!url || !anonKey || !serviceKey) return json({ error: 'not_configured' }, 501, origin)
    const userAuth = req.headers.get('authorization')
    if (!userAuth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, origin)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ error: 'bad_request' }, 400, origin)
    }
    const invitationId = typeof body.invitationId === 'string' ? body.invitationId : ''
    const token = typeof body.token === 'string' ? body.token : ''
    if (!UUID.test(invitationId) || !TOKEN.test(token)) {
      return json({ error: 'bad_request' }, 400, origin)
    }

    // 1. Leer la invitación con la sesión de quien llama: la base (RLS) solo se
    //    la muestra a dueños y administradores de ese negocio. El mail sale de
    //    la base, nunca del pedido.
    const res = await fetchFn(
      `${url}/rest/v1/invitations?select=email&id=eq.${invitationId}` +
        '&accepted_at=is.null&revoked_at=is.null',
      {
        headers: { apikey: anonKey, Authorization: userAuth, 'Accept-Profile': 'core' },
      },
    )
    if (res.status === 401 || res.status === 403) return json({ error: 'forbidden' }, 403, origin)
    if (!res.ok) return json({ error: 'server_error' }, 500, origin)
    const rows = (await res.json()) as { email?: string }[]
    const email = rows[0]?.email
    if (!email) return json({ error: 'not_found' }, 404, origin)

    // 2. Invitación de Supabase Auth: elegir contraseña y seguir a aceptar.
    const panelUrl = (deps.env.PANEL_URL ?? origin ?? '').replace(/\/$/, '')
    const redirect = panelUrl
      ? `?redirect_to=${encodeURIComponent(
          `${panelUrl}/reset-password?next=${encodeURIComponent(`/invitacion/${token}`)}`,
        )}`
      : ''
    const serviceHeaders: Record<string, string> = {
      apikey: serviceKey,
      'Content-Type': 'application/json',
    }
    if (serviceKey.startsWith('eyJ')) serviceHeaders.Authorization = `Bearer ${serviceKey}`
    const invite = await fetchFn(`${url}/auth/v1/invite${redirect}`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({ email }),
    })
    if (invite.ok) return json({ status: 'invited', email }, 200, origin)
    // Ya tenía cuenta: entra con su contraseña y abre el link de la invitación.
    if (invite.status === 422) return json({ status: 'existing_user', email }, 200, origin)
    return json({ status: 'not_sent', email }, 200, origin)
  }
}
