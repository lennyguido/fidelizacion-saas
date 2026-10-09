import { EmptyState } from '@plataforma/ui'
import { useActiveBusiness } from './ActiveBusinessContext'
import { BrandingForm } from './BrandingForm'
import { LogoUploader } from './LogoUploader'

/** /b/:slug/negocio — nombre, color, zona horaria y logo. Solo dueño/admin. */
export function BusinessSettingsPage() {
  const { business } = useActiveBusiness()

  if (business.role === 'staff') {
    return (
      <EmptyState
        title="Solo el dueño o un administrador"
        description="Pedile a quien administra el negocio que haga estos cambios."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Mi negocio</h1>
        <p className="mt-1 text-sm text-slate-600">
          Así ven tus clientes tu tarjeta de puntos. La dirección del club (/{business.slug}) no
          cambia.
        </p>
      </div>
      <BrandingForm key={business.id} business={business} />
      <LogoUploader business={business} />
    </div>
  )
}
