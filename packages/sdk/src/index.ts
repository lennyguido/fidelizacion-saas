// Acceso a datos de la plataforma. Es el único lugar que habla con Supabase.
export { readPublicEnv, type PublicEnv } from './env.ts'
export { getSupabase } from './client.ts'
