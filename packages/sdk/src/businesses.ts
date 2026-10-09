import { getSupabase } from './client.ts'
import { fromPostgrestError } from './errors.ts'
import type { Tables } from './tables.ts'
import type { Business, MemberRole, MyBusiness } from './types.ts'

type BusinessRow = Pick<
  Tables<'businesses'>,
  | 'id'
  | 'name'
  | 'slug'
  | 'timezone'
  | 'currency'
  | 'logo_path'
  | 'primary_color'
  | 'secondary_color'
>

export function toBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    currency: row.currency,
    logoPath: row.logo_path,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
  }
}

/** Negocios donde el usuario actual es miembro activo, con su rol. */
export async function listMyBusinesses(userId: string): Promise<MyBusiness[]> {
  const { data, error } = await getSupabase()
    .from('memberships')
    .select(
      'role, business:businesses!inner(id, name, slug, timezone, currency, logo_path, primary_color, secondary_color)',
    )
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw fromPostgrestError(error)
  return (data ?? [])
    .map((row) => ({ ...toBusiness(row.business), role: row.role as MemberRole }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_slug_available', { p_slug: slug })
  if (error) throw fromPostgrestError(error)
  return data === true
}

export async function createBusiness(name: string, slug: string): Promise<Business> {
  const { data, error } = await getSupabase().rpc('create_business', { p_name: name, p_slug: slug })
  if (error) throw fromPostgrestError(error)
  return toBusiness(data)
}

/** Módulos habilitados hoy para un negocio. */
export async function listEnabledModules(businessId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('business_modules')
    .select('module_id, starts_at, ends_at')
    .eq('business_id', businessId)
    .eq('enabled', true)

  if (error) throw fromPostgrestError(error)
  const now = Date.now()
  return (data ?? [])
    .filter(
      (m) => Date.parse(m.starts_at) <= now && (m.ends_at === null || Date.parse(m.ends_at) > now),
    )
    .map((m) => m.module_id)
}
