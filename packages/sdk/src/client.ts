import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import type { PublicEnv } from './env.ts'

function createPlatformClient(env: PublicEnv) {
  return createClient<Database, 'core'>(env.supabaseUrl, env.supabasePublishableKey, {
    db: { schema: 'core' },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
}

export type PlatformClient = ReturnType<typeof createPlatformClient>

let client: PlatformClient | undefined

/**
 * Inicializa el cliente único de Supabase para el navegador.
 * Por defecto apunta al esquema `core`; los módulos usan `.schema('<modulo>')`.
 */
export function initSupabase(env: PublicEnv): PlatformClient {
  client ??= createPlatformClient(env)
  return client
}

export function getSupabase(): PlatformClient {
  if (!client) {
    throw new Error('Supabase no fue inicializado: llamar a initSupabase() al iniciar la app')
  }
  return client
}
