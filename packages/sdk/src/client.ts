import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PublicEnv } from './env.ts'

let client: SupabaseClient | undefined

/** Cliente único de Supabase para el navegador. */
export function getSupabase(env: PublicEnv): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}
