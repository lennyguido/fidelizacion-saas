// Acceso a datos de la plataforma. Es el único lugar que habla con Supabase.
export { readPublicEnv, type PublicEnv } from './env.ts'
export { getSupabase, initSupabase, type PlatformClient } from './client.ts'
export {
  AppError,
  errorMessage,
  fromAuthError,
  fromPostgrestError,
  type AppErrorCode,
} from './errors.ts'
export type { Business, MemberRole, MyBusiness } from './types.ts'
export * as auth from './auth.ts'
export * as businesses from './businesses.ts'
export * as customers from './customers.ts'
export { CUSTOMER_STATUSES, type CustomerStatus } from './customers.ts'
export { isValidSlug, slugify } from './slug.ts'
export type { Session } from '@supabase/supabase-js'
