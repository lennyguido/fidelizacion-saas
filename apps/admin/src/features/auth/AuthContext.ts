import { createContext, useContext } from 'react'
import type { Session } from '@plataforma/sdk'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session }

export const AuthContext = createContext<AuthState>({ status: 'loading' })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/** Para componentes que solo se renderizan con sesión (dentro de <RequireAuth>). */
export function useSession(): Session {
  const state = useAuth()
  if (state.status !== 'signed_in') throw new Error('useSession requiere una sesión activa')
  return state.session
}
