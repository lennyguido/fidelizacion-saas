import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CUSTOMER_STATUSES, errorMessage, startOfDayInTimeZone, visits } from '@plataforma/sdk'
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

      <VisitsCard />

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

/** Visitas de hoy y de los últimos 7 días (en la hora del negocio). */
function VisitsCard() {
  const { business } = useActiveBusiness()
  const counts = useQuery({
    queryKey: ['customers', business.id, 'visit-counts'],
    queryFn: async () => {
      const today = startOfDayInTimeZone(business.timezone)
      const weekAgo = startOfDayInTimeZone(business.timezone, new Date(), 6)
      const [day, week] = await Promise.all([
        visits.countBetween(business.id, today),
        visits.countBetween(business.id, weekAgo),
      ])
      return { day, week }
    },
  })

  const percent = (part: number, total: number) =>
    total === 0 ? 0 : Math.round((part / total) * 100)

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold">Visitas</h2>
      {counts.isPending && <Spinner />}
      {counts.error && <Alert tone="error">{errorMessage(counts.error)}</Alert>}
      {counts.data && (
        <dl className="grid grid-cols-2 gap-4">
          {[
            { label: 'Hoy', value: counts.data.day },
            { label: 'Últimos 7 días', value: counts.data.week },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
              <dd className="mt-1 text-2xl font-bold">{item.value.total}</dd>
              <dd className="text-xs text-slate-500">
                {percent(item.value.identified, item.value.total)}% con cliente identificado
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}
