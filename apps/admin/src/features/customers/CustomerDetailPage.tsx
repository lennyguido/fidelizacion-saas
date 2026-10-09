import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import {
  customers,
  errorMessage,
  formatMoney,
  formatPhone,
  visits,
  type Customer,
  type CustomerInput,
  type Visit,
} from '@plataforma/sdk'
import { Alert, Button, Card, FullPageSpinner, useToast } from '@plataforma/ui'
import { CustomerModulePanels } from '../../modules/CustomerModulePanels'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { formatDateTime, formatDaysAgo } from '../../lib/format'
import { CustomerForm } from './CustomerForm'
import { useCustomer, useCustomerVisits, useInvalidateCustomers } from './queries'
import { StatusBadge } from './StatusBadge'
import { VisitHistory } from './VisitHistory'

export function CustomerDetailPage() {
  const { customerId = '' } = useParams()
  const { business } = useActiveBusiness()
  const customer = useCustomer(business.id, customerId)
  const history = useCustomerVisits(business.id, customerId)

  if (customer.isPending) return <FullPageSpinner />
  if (customer.error) return <Alert tone="error">{errorMessage(customer.error)}</Alert>

  return (
    <section className="flex flex-col gap-4">
      <Link to={`/b/${business.slug}/clientes`} className="text-sm text-slate-500 hover:underline">
        ← Clientes
      </Link>
      <CustomerHeader customer={customer.data} />
      <CustomerStatsCard customer={customer.data} />
      <CustomerModulePanels
        customerId={customer.data.id}
        archived={customer.data.status === 'archived'}
      />
      <Card>
        <h2 className="mb-2 text-base font-semibold">Historial de visitas</h2>
        {history.isPending && <p className="text-sm text-slate-500">Cargando…</p>}
        {history.error && <Alert tone="error">{errorMessage(history.error)}</Alert>}
        {history.data && <VisitHistoryContainer customer={customer.data} items={history.data} />}
      </Card>
    </section>
  )
}

function VisitHistoryContainer({ customer, items }: { customer: Customer; items: Visit[] }) {
  const { business } = useActiveBusiness()
  const invalidate = useInvalidateCustomers(business.id)
  return (
    <VisitHistory
      items={items}
      timeZone={business.timezone}
      currency={business.currency}
      canVoid={business.role !== 'staff' && customer.status === 'active'}
      onChanged={invalidate}
    />
  )
}

function CustomerHeader({ customer }: { customer: Customer }) {
  const { business } = useActiveBusiness()
  const navigate = useNavigate()
  const toast = useToast()
  const invalidate = useInvalidateCustomers(business.id)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canManage = business.role !== 'staff'

  const recordVisit = useMutation({
    mutationFn: () => visits.record({ businessId: business.id, customerId: customer.id }),
    onSuccess: async () => {
      await invalidate()
      toast.show(`Visita registrada para ${customer.name}`, 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  const update = useMutation({
    mutationFn: (input: CustomerInput) => customers.update(customer.id, input),
    onSuccess: async () => {
      await invalidate()
      setEditing(false)
      toast.show('Cambios guardados', 'success')
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const archive = useMutation({
    mutationFn: () => customers.archive(customer.id),
    onSuccess: async () => {
      await invalidate()
      toast.show(`${customer.name} fue archivado`, 'success')
      navigate(`/b/${business.slug}/clientes`, { replace: true })
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  const reactivate = useMutation({
    mutationFn: () => customers.reactivate(customer.id),
    onSuccess: async () => {
      await invalidate()
      toast.show(`${customer.name} volvió a la lista de clientes`, 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  if (editing) {
    return (
      <Card>
        <h1 className="mb-4 text-xl font-bold">Editar cliente</h1>
        <CustomerForm
          initial={{
            name: customer.name,
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            notes: customer.notes ?? '',
          }}
          submitLabel="Guardar"
          submitting={update.isPending}
          error={error}
          onSubmit={(input) => {
            setError(null)
            update.mutate(input)
          }}
          onCancel={() => setEditing(false)}
        />
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-slate-500">
            {[formatPhone(customer.phone), customer.email].filter(Boolean).join(' · ') ||
              'Sin datos de contacto'}
          </p>
          {customer.notes && <p className="mt-1 text-sm text-slate-600">{customer.notes}</p>}
        </div>
        {customer.stats && <StatusBadge status={customer.stats.status} />}
      </div>
      {customer.status === 'archived' ? (
        <div className="flex flex-col gap-3">
          <Alert>Este cliente está archivado: no aparece en la lista ni en el mostrador.</Alert>
          {canManage && (
            <div>
              <Button
                variant="secondary"
                size="lg"
                loading={reactivate.isPending}
                onClick={() => reactivate.mutate()}
              >
                Reactivar
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" loading={recordVisit.isPending} onClick={() => recordVisit.mutate()}>
            + Registrar visita
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setEditing(true)}>
            Editar
          </Button>
          {canManage && (
            <Button
              variant="ghost"
              size="lg"
              loading={archive.isPending}
              onClick={() => archive.mutate()}
            >
              Archivar
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function CustomerStatsCard({ customer }: { customer: Customer }) {
  const { business } = useActiveBusiness()
  const stats = customer.stats
  if (!stats) return null

  const items = [
    { label: 'Visitas', value: String(stats.visitCount) },
    { label: 'Última visita', value: formatDaysAgo(stats.lastVisitAt) },
    {
      label: 'Viene cada',
      value:
        stats.medianIntervalDays === null ? '—' : `${Math.round(stats.medianIntervalDays)} días`,
    },
    { label: 'Ticket promedio', value: formatMoney(stats.avgTicketMinor, business.currency) },
    { label: 'Gastó en total', value: formatMoney(stats.totalSpendMinor, business.currency) },
    { label: 'Riesgo', value: `${stats.riskScore}/100` },
  ]

  return (
    <Card>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
            <dd className="mt-1 text-lg font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
      {stats.expectedNextVisitAt && stats.visitCount > 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Próxima visita esperada: {formatDateTime(stats.expectedNextVisitAt, business.timezone)}
        </p>
      )}
    </Card>
  )
}
