import { LOGO_BUCKET, logoFileError, logoObjectPath, normalizeHexColor } from './branding.ts'
import { getSupabase } from './client.ts'
import { AppError, fromPostgrestError } from './errors.ts'
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

function toBusiness(row: BusinessRow): Business {
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

export interface BrandingInput {
  name: string
  /** "#RRGGBB" o null para volver al color por defecto. */
  primaryColor: string | null
  timezone: string
}

/** Guarda nombre, color y zona horaria. Solo dueño/admin (RLS businesses_update). */
export async function updateBranding(businessId: string, input: BrandingInput): Promise<void> {
  const primaryColor = input.primaryColor === null ? null : normalizeHexColor(input.primaryColor)
  if (input.primaryColor !== null && primaryColor === null) {
    throw new AppError('invalid', 'invalid color')
  }
  const { data, error } = await getSupabase()
    .from('businesses')
    .update({ name: input.name.trim(), primary_color: primaryColor, timezone: input.timezone })
    .eq('id', businessId)
    .select('id')
  if (error) throw fromPostgrestError(error)
  // Sin filas: RLS no dejó editar (por ejemplo, el usuario es staff).
  if (!data || data.length === 0) throw new AppError('forbidden', 'cannot update business')
}

/**
 * Sube el logo a "{business_id}/logo-<timestamp>.<ext>" y lo deja como logo del negocio.
 * Cada logo nuevo tiene otro nombre, así ningún teléfono se queda con el viejo en caché.
 */
export async function uploadLogo(businessId: string, file: File): Promise<string> {
  if (logoFileError(file)) throw new AppError('invalid', 'invalid logo file')
  const path = logoObjectPath(businessId, file.type, Date.now())
  const supabase = getSupabase()
  const upload = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (upload.error) throw new AppError('upload_failed', upload.error.message)

  const { error } = await supabase
    .from('businesses')
    .update({ logo_path: path })
    .eq('id', businessId)
  if (error) throw fromPostgrestError(error)
  return path
}

/** Link público del logo (el bucket es público: un logo no es un dato sensible). */
export function logoUrl(logoPath: string | null): string | null {
  if (!logoPath) return null
  return getSupabase().storage.from(LOGO_BUCKET).getPublicUrl(logoPath).data.publicUrl
}
