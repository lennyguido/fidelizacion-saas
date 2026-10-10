import { Link } from 'react-router'
import { errorMessage, formatMoney, formatPhone, type CustomerListItem } from '@plataforma/sdk'
import { Alert, Card, EmptyState, Spinner } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useCustomerSearch } from '../../features/customers/queries'
import { StatusBadge } from '../../features/customers/StatusBadge'
import { formatDaysAgo } from '../../lib/format'
import { useCampaigns } from './queries'

const campaignStatusLabels = { draft: 'Borrador', sent: 'Enviada', cancelled: 'Cancelada' } as const

export function RecoveryPage() {
  const { business } = useActiveBusiness()
  const base = `/b/${business.slug}/recuperacion`
  const canManage = business.role !== 'staff'

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recuperación</h1>
          <p className="text-sm text-slate-600">
            Clientes que venían seguido y dejaron de venir. Escribiles antes de perderlos.
          </p>
        </div>
        {canManage && (
          <Link
            to={`${base}/campanas/nueva`}
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nueva campaña
          </Link>
        )}
      </div>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${base}/automatico`}
            className="rounded-lg px-4 py-2 text-sm font-medium ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Automático
          </Link>
          <Link
            to={`${base}/mensajes`}
            className="rounded-lg px-4 py-2 text-sm font-medium ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Mensajes listos
          </Link>
        </div>
      )}
      <AtRiskList status="AT_RISK" title="En riesgo" />
      <AtRiskList status="INACTIVE" title="Inactivos" />
      {canManage && <CampaignList />}
    </section>
  )
}

function AtRiskList({ status, title }: { status: 'AT_RISK' | 'INACTIVE'; title: string }) {
  const { business } = useActiveBusiness()
  const results = useCustomerSearch(business.id, '', status, 50)
  const items = [...(results.data ?? [])].sort((a, b) => b.totalSpendMinor - a.totalSpendMinor)

  return (
    <Card className="flex flex-col gap-2 p-0">
      <h2 className="px-4 pt-4 text-base font-semibold">
        {title} {results.data && <span className="text-slate-400">({results.data.length})</span>}
      </h2>
      {results.isPending && <Spinner />}
      {results.error && <Alert tone="error">{errorMessage(results.error)}</Alert>}
      {results.data && items.length === 0 && (
        <p className="px-4 pb-4 text-sm text-slate-500">Nadie por ahora. ¡Bien!</p>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {items.map((customer) => (
            <AtRiskRow key={customer.id} customer={customer} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function AtRiskRow({ customer }: { customer: CustomerListItem }) {
  const { business } = useActiveBusiness()
  return (
    <li>
      <Link
        to={`/b/${business.slug}/clientes/${customer.id}`}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{customer.name}</p>
          <p className="truncate text-sm text-slate-500">
            {formatPhone(customer.phone) || 'Sin teléfono'} · última visita{' '}
            {formatDaysAgo(customer.lastVisitAt).toLowerCase()} · gastó{' '}
            {formatMoney(customer.totalSpendMinor, business.currency)}
          </p>
        </div>
        <StatusBadge status={customer.status} />
      </Link>
    </li>
  )
}

function CampaignList() {
  const { business } = useActiveBusiness()
  const all = useCampaigns(business.id)
  // Las automáticas se ven en "Automático".
  const manual = all.data?.filter((campaign) => campaign.automationKind === null)
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Campañas</h2>
      {all.isPending && <Spinner />}
      {all.error && <Alert tone="error">{errorMessage(all.error)}</Alert>}
      {manual && manual.length === 0 && (
        <EmptyState
          title="Todavía no hiciste campañas"
          description="Elegí a quién escribirle, armá el mensaje y medí cuántos vuelven."
        />
      )}
      {manual && manual.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {manual.map((campaign) => (
            <li key={campaign.id}>
              <Link
                to={`/b/${business.slug}/recuperacion/campanas/${campaign.id}`}
                className="flex items-center justify-between gap-3 py-2 hover:underline"
              >
                <span className="font-medium">{campaign.name}</span>
                <span className="text-sm text-slate-500">
                  {campaignStatusLabels[campaign.status]}
                  {campaign.status === 'sent' ? ` · ${campaign.recipientsCount} clientes` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
