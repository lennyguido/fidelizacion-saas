// Respuestas HTTP y CORS.

export type ErrorCode =
  | 'not_configured'
  | 'invalid_token'
  | 'card_not_found'
  | 'logo_required'
  | 'provider_error'
  | 'unauthorized'
  | 'not_found'
  | 'bad_request'
  | 'method_not_allowed'
  | 'server_error'

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const allowOrigin =
    allowed.length === 0 ? '*' : origin && allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })
}

export function fail(code: ErrorCode, status: number): Response {
  return json({ error: code }, status)
}

/** Compara secretos sin cortar antes en el primer carácter distinto. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export const CARD_TOKEN = /^[0-9a-f]{64}$/
