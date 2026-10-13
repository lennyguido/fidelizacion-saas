// Edge Function `grant-access` (D-043): el administrador de la plataforma da un
// acceso (mail + plan) y se le manda a esa persona la invitación para elegir su
// contraseña. Lo externo (secrets, fetch) llega por parámetro: se prueba sin red.

export type Env = Record<string, string | undefined>

export interface HandlerDeps {
  env: Env
  fetch?: typeof fetch
}

const PLANS = ['barrio', 'local', 'cadena', 'turnos']

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
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const plan = typeof body.plan === 'string' ? body.plan : ''
    const note = typeof body.note === 'string' ? body.note.slice(0, 200) : null
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !PLANS.includes(plan)) {
      return json({ error: 'bad_request' }, 400, origin)
    }

    // 1. Crear el acceso con la sesión de quien llama: la base exige que sea
    //    administrador de la plataforma.
    const grant = await fetchFn(`${url}/rest/v1/rpc/create_access_grant`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: userAuth,
        'Content-Type': 'application/json',
        'Content-Profile': 'core',
      },
      body: JSON.stringify({ p_email: email, p_plan_id: plan, p_note: note }),
    })
    if (grant.status === 401 || grant.status === 403)
      return json({ error: 'forbidden' }, 403, origin)
    if (!grant.ok) return json({ error: 'server_error' }, 500, origin)

    // 2. Invitación por mail (link para elegir contraseña en el panel).
    const panelUrl = (deps.env.PANEL_URL ?? origin ?? '').replace(/\/$/, '')
    const redirect = panelUrl
      ? `?redirect_to=${encodeURIComponent(`${panelUrl}/reset-password`)}`
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
    if (invite.ok) return json({ status: 'invited', email, plan }, 200, origin)
    // Ya tenía cuenta: no hace falta invitarla, entra con su contraseña y crea el negocio.
    if (invite.status === 422) return json({ status: 'existing_user', email, plan }, 200, origin)
    return json({ status: 'grant_without_email', email, plan }, 200, origin)
  }
}
