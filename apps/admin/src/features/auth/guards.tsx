import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageSpinner } from '@plataforma/ui'
import { useAuth } from './AuthContext'

/** Solo con sesión; si no, al login recordando a dónde quería ir. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const state = useAuth()
  const location = useLocation()

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'signed_out') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

/**
 * Solo sin sesión (login, registro). Al iniciar sesión vuelve a la página de la que
 * venía (por ejemplo, el link de una invitación) o al inicio.
 */
export function PublicOnly({ children }: { children: ReactNode }) {
  const state = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'signed_in')
    return <Navigate to={from && from !== '/' ? from : '/'} replace />
  return children
}
