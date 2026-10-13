// Edge Function `tap` (D-048): cuenta el toque de un cartel y redirige a su destino
// (por defecto, el link de reseñas de Google del negocio). No guarda datos de quien
// toca (ni IP ni dispositivo). Lo externo (secrets, fetch) llega por parámetro.

export type Env = Record<string, string | undefined>

export interface HandlerDeps {
  env: Env
  fetch?: typeof fetch
}

const CODE = /^[A-Za-z0-9]{6,32}$/
const FALLBACK = 'https://neriva.net'

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const { SUPABASE_URL: url } = deps.env
  const serviceKey = deps.env.SUPABASE_SERVICE_ROLE_KEY
  const fetchFn = deps.fetch ?? fetch

  return async (req) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405 })
    }
    const fallback = deps.env.TAP_FALLBACK_URL ?? FALLBACK
    const requestUrl = new URL(req.url)
    const code = requestUrl.pathname.split('/').filter(Boolean).pop() ?? ''
    if (!CODE.test(code) || !url || !serviceKey) return redirect(fallback)

    const source = requestUrl.searchParams.get('s') === 'q' ? 'qr' : 'nfc'
    const headers: Record<string, string> = {
      apikey: serviceKey,
      'Content-Type': 'application/json',
      'Content-Profile': 'reputation',
    }
    if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`

    try {
      const res = await fetchFn(`${url}/rest/v1/rpc/resolve_tap`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_code: code, p_source: source }),
      })
      if (!res.ok) return redirect(fallback)
      const destination = (await res.json()) as unknown
      if (typeof destination === 'string' && destination.startsWith('https://')) {
        return redirect(destination)
      }
    } catch {
      // Si la base no responde, al menos no dejar a la persona en una página de error.
    }
    return redirect(fallback)
  }
}
