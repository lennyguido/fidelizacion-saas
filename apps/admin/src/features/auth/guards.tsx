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

/** Solo sin sesión (login, registro); si ya ingresó, al inicio. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const state = useAuth()
  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'signed_in') return <Navigate to="/" replace />
  return children
}
