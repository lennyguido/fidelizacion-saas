// Rutas de `sales-ingest`. Lo externo (secrets, base de datos) llega por parámetro:
// así se prueba sin credenciales reales.
import { keyFromHeaders, parseSale } from './sale.ts'

export type Env = Record<string, string | undefined>
export type Rpc = (
  schema: 'core' | 'loyalty',
  fn: string,
  args: Record<string, unknown>,
) => Promise<unknown>

export interface HandlerDeps {
  env: Env
  fetch?: typeof fetch
  rpc?: Rpc
}

interface IngestResult {
  status?: string
  message?: string
  visitId?: string
  identified?: boolean
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Llama funciones de Postgres con la service role (la clave nunca sale de acá). */
export function createRpc(supabaseUrl: string, serviceKey: string, fetchFn: typeof fetch): Rpc {
  return async (schema, fn, args) => {
    const headers: Record<string, string> = {
      apikey: serviceKey,
      'Content-Type': 'application/json',
      'Content-Profile': schema,
      'Accept-Profile': schema,
    }
    // Las claves clásicas son JWT; las nuevas (sb_secret_...) van solo en `apikey`.
    if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`
    const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${fn} failed (${res.status}): ${text.slice(0, 300)}`)
    return text ? JSON.parse(text) : null
  }
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const url = deps.env.SUPABASE_URL
  const serviceKey = deps.env.SUPABASE_SERVICE_ROLE_KEY
  const rpc =
    deps.rpc ?? (url && serviceKey ? createRpc(url, serviceKey, deps.fetch ?? fetch) : null)

  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    if (!rpc) return json({ error: 'not_configured' }, 501)
    const key = keyFromHeaders(req.headers)
    if (!key) return json({ error: 'unauthorized' }, 401)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'bad_request', message: 'invalid JSON' }, 400)
    }
    const sale = parseSale(body)
    if ('error' in sale) return json({ error: 'bad_request', message: sale.error }, 400)

    try {
      const keyHash = await sha256Hex(key)
      const customerId = sale.memberCode
        ? await rpc('loyalty', 'integration_member_customer', {
            p_key_hash: keyHash,
            p_code: sale.memberCode,
          })
        : null
      const result = (await rpc('core', 'ingest_sale', {
        p_key_hash: keyHash,
        p_receipt: sale.receipt,
        p_amount_minor: sale.amountMinor,
        p_occurred_at: sale.occurredAt,
        p_phone: sale.phone,
        p_customer_id: customerId,
      })) as IngestResult | null
      return toResponse(result)
    } catch (err) {
      console.error(`sales-ingest: ${err instanceof Error ? err.message : String(err)}`)
      return json({ error: 'server_error' }, 500)
    }
  }
}

function toResponse(result: IngestResult | null): Response {
  const visit = { visitId: result?.visitId, identified: result?.identified }
  switch (result?.status) {
    case 'created':
      return json({ status: 'created', ...visit }, 201)
    case 'duplicate':
      return json({ status: 'duplicate', ...visit }, 200)
    case 'unauthorized':
      return json({ error: 'unauthorized' }, 401)
    case 'invalid':
      return json({ error: 'bad_request', message: result.message }, 400)
    default:
      return json({ error: 'server_error' }, 500)
  }
}
