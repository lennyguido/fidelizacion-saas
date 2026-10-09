import { Link } from 'react-router'
import { CUSTOMER_STATUSES, errorMessage } from '@plataforma/sdk'
import { Alert, Card, Spinner } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { useCustomerCounts } from '../features/customers/queries'
import { statusInfo } from '../features/customers/status'

const roleLabels = { owner: 'Dueño', admin: 'Administrador', staff: 'Empleado' } as const

export function HomePage() {
  const { business } = useActiveBusiness()
  const counts = useCustomerCounts(business.id)
  const base = `/b/${business.slug}`

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
        <p className="text-sm text-slate-500">{roleLabels[business.role]}</p>
      </div>

      <Link
        to={`${base}/mostrador`}
        className="flex items-center justify-center rounded-xl bg-slate-900 px-5 py-4 text-lg font-semibold text-white shadow-sm hover:bg-slate-700"
      >
        Registrar una visita
      </Link>

      <Card>
        <h2 className="mb-4 text-base font-semibold">Tus clientes</h2>
        {counts.isPending && <Spinner />}
        {counts.error && <Alert tone="error">{errorMessage(counts.error)}</Alert>}
        {counts.data && (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {CUSTOMER_STATUSES.map((status) => (
              <div key={status} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-medium text-slate-500">{statusInfo[status].plural}</dt>
                <dd className={`mt-1 text-2xl font-bold ${statusInfo[status].text}`}>
                  {counts.data[status]}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-base font-semibold">Próximos pasos</h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>
            <Link to={`${base}/clientes/nuevo`} className="underline">
              Cargá tus clientes
            </Link>{' '}
            o registralos al pasar por el mostrador.
          </li>
          <li>Configurá el programa de puntos y la primera recompensa (próximamente).</li>
          <li>Imprimí el QR del local (próximamente).</li>
        </ol>
      </Card>
    </section>
  )
}
