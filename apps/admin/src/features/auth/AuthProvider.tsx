import { useEffect, useState, type ReactNode } from 'react'
import { auth } from '@plataforma/sdk'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true

    auth.getSession().then((session) => {
      if (!active) return
      setState(session ? { status: 'signed_in', session } : { status: 'signed_out' })
    })

    const unsubscribe = auth.onAuthChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear()
      setState(session ? { status: 'signed_in', session } : { status: 'signed_out' })
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
