// Llamadas a las funciones `loyalty.wallet_*` con la service role, por PostgREST.
// La clave nunca sale de la Edge Function.

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>

export class RpcError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'RpcError'
  }
}

export function createRpc(supabaseUrl: string, serviceKey: string, fetchFn: typeof fetch): Rpc {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    'Content-Type': 'application/json',
    'Content-Profile': 'loyalty',
    'Accept-Profile': 'loyalty',
  }
  // Las claves clásicas son JWT; las nuevas (sb_secret_...) van solo en `apikey`.
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`

  return async (fn, args) => {
    const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    })
    const text = await res.text()
    if (!res.ok)
      throw new RpcError(res.status, `${fn} failed (${res.status}): ${text.slice(0, 300)}`)
    return text ? JSON.parse(text) : null
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return toHex(new Uint8Array(digest))
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomHex(byteCount: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(byteCount)))
}
