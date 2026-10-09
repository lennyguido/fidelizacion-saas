import { useState } from 'react'
import { Link } from 'react-router'
import { CUSTOMER_STATUSES, errorMessage, formatPhone, type CustomerStatus } from '@plataforma/sdk'
import { Alert, Card, EmptyState, Spinner, TextField, cn } from '@plataforma/ui'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { formatDaysAgo } from '../../lib/format'
import { useCustomerSearch } from './queries'
import { StatusBadge } from './StatusBadge'
import { statusInfo } from './status'

export function CustomersPage() {
  const { business } = useActiveBusiness()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CustomerStatus | null>(null)
  const debouncedQuery = useDebouncedValue(query)
  const results = useCustomerSearch(business.id, debouncedQuery, status, 50)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <div className="flex gap-2">
          {business.role !== 'staff' && (
            <Link
              to={`/b/${business.slug}/clientes/importar`}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              Importar
            </Link>
          )}
          <Link
            to={`/b/${business.slug}/clientes/nuevo`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nuevo cliente
          </Link>
        </div>
      </div>

      <TextField
        label="Buscar"
        type="search"
        placeholder="Nombre, teléfono o email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por estado">
        {[null, ...CUSTOMER_STATUSES].map((value) => (
          <button
            key={value ?? 'all'}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset',
              status === value
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white text-slate-700 ring-slate-300',
            )}
          >
            {value ? statusInfo[value].plural : 'Todos'}
          </button>
        ))}
      </div>

      {results.isPending && <Spinner />}
      {results.error && <Alert tone="error">{errorMessage(results.error)}</Alert>}
      {results.data && results.data.length === 0 && (
        <EmptyState
          title={query || status ? 'Sin resultados' : 'Todavía no hay clientes'}
          description={
            query || status
              ? 'Probá con otra búsqueda.'
              : 'Cargá el primero o registralo desde el mostrador.'
          }
        />
      )}
      {results.data && results.data.length > 0 && (
        <Card className="divide-y divide-slate-100 p-0">
          {results.data.map((customer) => (
            <Link
              key={customer.id}
              to={`/b/${business.slug}/clientes/${customer.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{customer.name}</p>
                <p className="truncate text-sm text-slate-500">
                  {formatPhone(customer.phone) || customer.email || 'Sin contacto'} ·{' '}
                  {customer.visitCount} {customer.visitCount === 1 ? 'visita' : 'visitas'} ·{' '}
                  {formatDaysAgo(customer.lastVisitAt)}
                </p>
              </div>
              <StatusBadge status={customer.status} />
            </Link>
          ))}
        </Card>
      )}
    </section>
  )
}
