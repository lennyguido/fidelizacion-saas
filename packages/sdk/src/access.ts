// Accesos a la plataforma (D-043). Solo para el administrador de la plataforma:
// da un acceso (mail + plan) después de cobrar, y la persona recibe la invitación.
import { getSupabase } from './client.ts'
import { AppError, fromPostgrestError } from './errors.ts'

export type SalesPlan = 'barrio' | 'local' | 'cadena'

export const SALES_PLANS: { id: SalesPlan; name: string }[] = [
  { id: 'barrio', name: 'Barrio' },
  { id: 'local', name: 'Local' },
  { id: 'cadena', name: 'Cadena' },
]

export type GrantStatus = 'pending' | 'used' | 'revoked'

export interface AccessGrant {
  id: string
  email: string
  planId: string
  status: GrantStatus
  note: string | null
  createdAt: string
  usedAt: string | null
}

/** Qué pasó con la invitación por mail. */
export type GrantResult = 'invited' | 'existing_user' | 'grant_without_email'

export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_platform_admin')
  if (error) throw fromPostgrestError(error)
  return data === true
}

export async function listGrants(): Promise<AccessGrant[]> {
  const { data, error } = await getSupabase()
    .from('access_grants')
    .select('id, email, plan_id, status, note, created_at, used_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw fromPostgrestError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    planId: row.plan_id,
    status: row.status as GrantStatus,
    note: row.note,
    createdAt: row.created_at,
    usedAt: row.used_at,
  }))
}

/** Crea el acceso y manda la invitación (Edge Function `grant-access`). */
export async function grant(
  email: string,
  plan: SalesPlan,
  note: string | null,
): Promise<GrantResult> {
  const { data, error } = await getSupabase().functions.invoke('grant-access', {
    body: { email, plan, note },
  })
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status
    if (status === 403) throw new AppError('forbidden', 'platform admin only')
    throw new AppError('unknown', error.message)
  }
  return ((data as { status?: GrantResult } | null)?.status ?? 'grant_without_email') as GrantResult
}

export async function revoke(grantId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_access_grant', { p_grant_id: grantId })
  if (error) throw fromPostgrestError(error)
}
