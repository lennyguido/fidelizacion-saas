export interface PublicEnv {
  supabaseUrl: string
  supabasePublishableKey: string
}

type RawEnv = Record<string, string | boolean | undefined>

/**
 * Lee y valida las variables públicas de Supabase.
 * Recibe `import.meta.env` desde cada app para que el SDK no dependa de Vite.
 */
export function readPublicEnv(raw: RawEnv): PublicEnv {
  const supabaseUrl = raw.VITE_SUPABASE_URL
  const supabasePublishableKey = raw.VITE_SUPABASE_PUBLISHABLE_KEY

  if (typeof supabaseUrl !== 'string' || supabaseUrl === '') {
    throw new Error('Falta VITE_SUPABASE_URL (ver .env.example)')
  }
  if (typeof supabasePublishableKey !== 'string' || supabasePublishableKey === '') {
    throw new Error('Falta VITE_SUPABASE_PUBLISHABLE_KEY (ver .env.example)')
  }
  if (supabasePublishableKey.startsWith('sb_secret_')) {
    throw new Error('Se configuró una secret key en el frontend. Usar la publishable key.')
  }

  return { supabaseUrl, supabasePublishableKey }
}
