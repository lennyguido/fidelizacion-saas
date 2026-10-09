import { Link } from 'react-router'
import { errorMessage, formatPhone } from '@plataforma/sdk'
import { Alert, Card, EmptyState, Spinner } from '@plataforma/ui'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { formatDaysAgo } from '../../lib/format'
import { useArchivedCustomers } from './queries'

/** Clientes archivados: desde acá se abre la ficha para reactivarlos. */
export function ArchivedCustomersList() {
  const { business } = useActiveBusiness()
  const archived = useArchivedCustomers(business.id, true)

  if (archived.isPending) return <Spinner />
  if (archived.error) return <Alert tone="error">{errorMessage(archived.error)}</Alert>
  if (archived.data.length === 0) {
    return (
      <EmptyState
        title="No hay clientes archivados"
        description="Cuando archives a alguien, va a aparecer acá y lo vas a poder reactivar."
      />
    )
  }

  return (
    <Card className="divide-y divide-slate-100 p-0">
      {archived.data.map((customer) => (
        <Link
          key={customer.id}
          to={`/b/${business.slug}/clientes/${customer.id}`}
          className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{customer.name}</p>
            <p className="truncate text-sm text-slate-500">
              {formatPhone(customer.phone) || customer.email || 'Sin contacto'} · archivado{' '}
              {formatDaysAgo(customer.archivedAt).toLowerCase()}
            </p>
          </div>
          <span className="text-sm font-medium text-slate-600">Ver</span>
        </Link>
      ))}
    </Card>
  )
}
