import { Link } from 'react-router'
import { errorMessage, weeklyDigest, type WeeklyDigest } from '@plataforma/sdk'
import { Alert, Card, EmptyState, FullPageSpinner } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { whatsappLink } from '../lib/clientAppUrl'
import { formatDaysAgo } from '../lib/format'
import { actionLink, useWeeklyDigest } from './weeklyDigestQuery'

/** /b/:slug/semana — resumen de la última semana completa (D-035). Solo dueño/admin. */
export function WeeklyDigestPage() {
  const { business } = useActiveBusiness()
  const digest = useWeeklyDigest(business.id, business.role !== 'staff')

  if (business.role === 'staff') {
    return (
      <EmptyState
        title="Solo el dueño o un administrador"
        description="El resumen de la semana lo ve quien administra el negocio."
      />
    )
  }
  if (digest.isPending) return <FullPageSpinner />
  if (digest.isError) return <Alert tone="error">{errorMessage(digest.error)}</Alert>
  const data = digest.data
  const base = `/b/${business.slug}`
  const link = actionLink(base, data.action)
  const change =
    data.baselineVisits && data.baselineVisits > 0
      ? Math.round(((data.visits - data.baselineVisits) / data.baselineVisits) * 100)
      : null

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resumen de la semana</h1>
        <p className="text-sm text-slate-600">
          Del lunes {formatDay(data.weekStart)} al domingo {formatDay(data.weekEnd)}.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Lo que te sugerimos</h2>
        <p className="text-sm">{weeklyDigest.actionText(data.action)}</p>
        {link && (
          <Link to={link.to} className="text-sm font-medium underline">
            {link.label}
          </Link>
        )}
        <a
          href={whatsappLink(data.businessPhone, weeklyDigest.whatsappText(data, business.name))}
          target="_blank"
          rel="noreferrer"
          className="self-start rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white"
        >
          Mandármelo por WhatsApp
        </a>
        {!data.businessPhone && (
          <p className="text-xs text-slate-500">
            Se abre WhatsApp para que elijas a quién mandarlo (por ejemplo, a tu propio chat).
          </p>
        )}
      </Card>

      <Card>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Visitas" value={String(data.visits)}>
            {change !== null && (
              <span className={change >= 0 ? 'text-green-700' : 'text-red-700'}>
                {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs. lo normal
              </span>
            )}
          </Tile>
          <Tile label="Con cliente" value={`${data.identifiedVisits} de ${data.visits}`} />
          <Tile label="Clientes nuevos" value={String(data.newCustomers)} />
          <Tile label="Recuperados" value={String(data.recoveredCustomers)} />
        </dl>
        {data.baselineVisits === null && (
          <p className="mt-3 text-xs text-slate-500">
            Para comparar con lo normal hacen falta 4 semanas con visitas.
          </p>
        )}
      </Card>

      <Alerts data={data} />

      <Card className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Habituales que dejaron de venir</h2>
        {data.atRiskRegulars.length === 0 ? (
          <p className="text-sm text-slate-600">Ninguno. ¡Bien!</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.atRiskRegulars.map((customer) => (
              <li key={customer.customerId} className="flex justify-between gap-3 py-2">
                <Link to={`${base}/clientes/${customer.customerId}`} className="underline">
                  {customer.name}
                </Link>
                <span className="text-slate-500">
                  {customer.visitCount} visitas · última: {formatDaysAgo(customer.lastVisitAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

function Alerts({ data }: { data: WeeklyDigest }) {
  const alerts: string[] = []
  if (data.visitsDropAlert) alerts.push('Las visitas bajaron más de 20 % comparadas con lo normal.')
  if (data.voidsAlert) alerts.push(`Se anularon ${data.voids} visitas, más que lo habitual.`)
  for (const alert of data.sameStaffAlerts) {
    alerts.push(
      `${alert.customerName}: ${alert.visits} visitas cargadas por ${alert.staffEmail ?? 'la misma persona'}. Revisá si son reales.`,
    )
  }
  if (alerts.length === 0) return null
  return (
    <Alert tone="error">
      <ul className="list-inside list-disc space-y-1">
        {alerts.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </Alert>
  )
}

function Tile({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-bold">{value}</dd>
      {children && <dd className="text-xs">{children}</dd>}
    </div>
  )
}

/** "2026-10-05" → "5/10". */
function formatDay(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${Number(day)}/${Number(month)}`
}
