// Conexión con la caja (D-033): claves por negocio para la Edge Function
// `sales-ingest` y un simulador para probar sin caja.
import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'

export interface IntegrationKey {
  id: string
  name: string
  /** Primeros caracteres, para reconocerla (no sirve para usarla). */
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export interface SimulatedSale {
  status: 'created' | 'duplicate' | 'invalid'
  identified: boolean
  message: string | null
}

/** Dirección a la que la caja manda las ventas. */
export function ingestUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/sales-ingest`
}

export async function listKeys(businessId: string): Promise<IntegrationKey[]> {
  const { data, error } = await getSupabase()
    .from('integration_keys')
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }))
}

/** Devuelve la clave completa: se muestra UNA sola vez (después solo queda el hash). */
export async function createKey(businessId: string, name: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_integration_key', {
    p_business_id: businessId,
    p_name: name,
  })
  if (error) throw fromPostgrestError(error)
  return String((data as { key?: string } | null)?.key ?? '')
}

export async function revokeKey(keyId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_integration_key', { p_key_id: keyId })
  if (error) throw fromPostgrestError(error)
}

/** Manda una venta de prueba como si viniera de la caja (comprobante "PRUEBA-..."). */
export async function simulateSale(
  businessId: string,
  amountMinor: number,
  phone: string | null,
): Promise<SimulatedSale> {
  const { data, error } = await getSupabase().rpc('simulate_sale', {
    p_business_id: businessId,
    p_amount_minor: amountMinor,
    p_phone: phone ?? undefined,
  })
  if (error) throw fromPostgrestError(error)
  const result = (data ?? {}) as { status?: SimulatedSale['status']; identified?: boolean; message?: string }
  return {
    status: result.status ?? 'invalid',
    identified: result.identified ?? false,
    message: result.message ?? null,
  }
}
