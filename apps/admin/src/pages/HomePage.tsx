import { useQuery } from '@tanstack/react-query'
import { customers, errorMessage, type CustomerStatus } from '@plataforma/sdk'
import { Alert, Card, Spinner } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'

const statusLabels: Record<CustomerStatus, { label: string; tone: string }> = {
  NEW: { label: 'Nuevos', tone: 'text-sky-700' },
  ACTIVE: { label: 'Activos', tone: 'text-emerald-700' },
  AT_RISK: { label: 'En riesgo', tone: 'text-amber-700' },
  INACTIVE: { label: 'Inactivos', tone: 'text-red-700' },
  RECOVERED: { label: 'Recuperados', tone: 'text-violet-700' },
}

const roleLabels = { owner: 'Dueño', admin: 'Administrador', staff: 'Empleado' } as const

export function HomePage() {
  const { business } = useActiveBusiness()
  const counts = useQuery({
    queryKey: ['customers', business.id, 'count-by-status'],
    queryFn: () => customers.countByStatus(business.id),
  })

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
        <p className="text-sm text-slate-500">{roleLabels[business.role]}</p>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold">Tus clientes</h2>
        {counts.isPending && <Spinner />}
        {counts.error && <Alert tone="error">{errorMessage(counts.error)}</Alert>}
        {counts.data && (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(Object.keys(statusLabels) as CustomerStatus[]).map((status) => (
              <div key={status} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-medium text-slate-500">{statusLabels[status].label}</dt>
                <dd className={`mt-1 text-2xl font-bold ${statusLabels[status].tone}`}>
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
          <li>Cargar clientes y registrar visitas en el mostrador (próxima versión).</li>
          <li>Configurar el programa de puntos y la primera recompensa.</li>
          <li>Imprimir el QR del local.</li>
        </ol>
      </Card>
    </section>
  )
}
