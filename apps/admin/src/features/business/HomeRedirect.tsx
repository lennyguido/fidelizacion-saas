import { Navigate } from 'react-router'
import { errorMessage } from '@plataforma/sdk'
import { Alert, FullPageSpinner } from '@plataforma/ui'
import { lastBusiness } from './lastBusiness'
import { useMyBusinesses } from './queries'

/** "/" → el último negocio usado, el primero, o el onboarding si no tiene ninguno. */
export function HomeRedirect() {
  const { data, isPending, error } = useMyBusinesses()

  if (isPending) return <FullPageSpinner />
  if (error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert tone="error">{errorMessage(error)}</Alert>
      </div>
    )
  }

  if (data.length === 0) return <Navigate to="/onboarding" replace />

  const last = lastBusiness.get()
  const target = data.find((b) => b.slug === last) ?? data[0]
  return <Navigate to={`/b/${target?.slug ?? ''}`} replace />
}
