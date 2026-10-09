import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './client.ts'
import { fromAuthError } from './errors.ts'

export interface SignUpResult {
  /** false cuando el proyecto exige confirmar el email antes de iniciar sesión. */
  hasSession: boolean
}

export async function signUp(
  email: string,
  password: string,
  redirectTo: string,
): Promise<SignUpResult> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  })
  if (error) throw fromAuthError(error)
  return { hasSession: data.session !== null }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password })
  if (error) throw fromAuthError(error)
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw fromAuthError(error)
}

export async function sendPasswordReset(email: string, redirectTo: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw fromAuthError(error)
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password })
  if (error) throw fromAuthError(error)
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession()
  return data.session
}

/** Se suscribe a cambios de sesión. Devuelve la función para desuscribirse. */
export function onAuthChange(
  callback: (event: string, session: Session | null) => void,
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) =>
    callback(event, session),
  )
  return () => data.subscription.unsubscribe()
}
