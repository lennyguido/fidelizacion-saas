// Tipos de dominio que usan las apps. Cuando el esquema `core` esté expuesto,
// las filas de la base se tipan con los tipos generados por `supabase gen types`
// y estas interfaces se derivan de ellos.

export type MemberRole = 'owner' | 'admin' | 'staff'

export interface Business {
  id: string
  name: string
  slug: string
  timezone: string
  currency: string
  logoPath: string | null
  primaryColor: string | null
  secondaryColor: string | null
}

export interface MyBusiness extends Business {
  role: MemberRole
}
