import { useEffect, useMemo } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { errorMessage } from '@plataforma/sdk'
import { Alert, EmptyState, FullPageSpinner } from '@plataforma/ui'
import { AppShell } from '../../layouts/AppShell'
import { ActiveBusinessContext } from './ActiveBusinessContext'
import { lastBusiness } from './lastBusiness'
import { useEnabledModules, useMyBusinesses } from './queries'

/** /b/:slug — resuelve el negocio activo (solo entre los del usuario) y monta el panel. */
export function BusinessLayout() {
  const { slug } = useParams()
  const myBusinesses = useMyBusinesses()
  const business = myBusinesses.data?.find((b) => b.slug === slug)
  const modules = useEnabledModules(business?.id ?? '')

  useEffect(() => {
    if (business) lastBusiness.set(business.slug)
  }, [business])

  const value = useMemo(
    () => (business && modules.data ? { business, modules: modules.data } : null),
    [business, modules.data],
  )

  if (myBusinesses.isPending) return <FullPageSpinner />
  if (myBusinesses.error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert tone="error">{errorMessage(myBusinesses.error)}</Alert>
      </div>
    )
  }
  if (!business) {
    return (
      <div className="mx-auto max-w-md p-6">
        <EmptyState
          title="No encontramos ese negocio"
          description="Puede que el link esté mal o que no tengas acceso."
          action={
            <Link to="/" className="text-sm font-medium text-slate-900 underline">
              Ir a mis negocios
            </Link>
          }
        />
      </div>
    )
  }
  if (modules.error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert tone="error">{errorMessage(modules.error)}</Alert>
      </div>
    )
  }
  if (!value) return <FullPageSpinner />

  return (
    <ActiveBusinessContext.Provider value={value}>
      <AppShell businesses={myBusinesses.data}>
        <Outlet />
      </AppShell>
    </ActiveBusinessContext.Provider>
  )
}
