import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage, formatMoney, stats, type StatsRange } from '@plataforma/sdk'
import { Alert, EmptyState, FullPageSpinner } from '@plataforma/ui'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { shortDate } from './chartTheme'
import { KpiTile } from './KpiTile'
import { NewReturningChart } from './NewReturningChart'
import { WeekdayChart } from './WeekdayChart'
import { WeeklySourceChart } from './WeeklySourceChart'

const RANGE_LABELS: Record<StatsRange, string> = {
  7: '7 días',
  30: '30 días',
  90: '3 meses',
  180: '6 meses',
  365: '1 año',
}

/** /b/:slug/estadisticas — tablero del dueño (D-042). Solo dueño/admin. */
export function StatsPage() {
  const { business } = useActiveBusiness()
  const [range, setRange] = useState<StatsRange>(30)
  const isManager = business.role !== 'staff'
  const query = useQuery({
    queryKey: ['customers', business.id, 'stats', range],
    queryFn: () => stats.get(business.id, range),
    enabled: isManager,
  })

  if (!isManager) {
    return (
      <EmptyState
        title="Solo el dueño o un administrador"
        description="Las estadísticas las ve quien administra el negocio."
      />
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[40px] leading-tight font-semibold tracking-tight">Estadísticas</h1>
          {query.data && (
            <p className="text-sm text-slate-500">
              Del {shortDate(query.data.from)} al {shortDate(query.data.to)}, comparado con los{' '}
              {range} días anteriores.
            </p>
          )}
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1" role="group" aria-label="Período">
          {stats.STATS_RANGES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                range === value ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
            >
              {RANGE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <FullPageSpinner />
      ) : query.isError ? (
        <Alert tone="error">{errorMessage(query.error)}</Alert>
      ) : (
        <StatsBody data={query.data} currency={business.currency} />
      )}
    </section>
  )
}

function StatsBody({ data, currency }: { data: stats.BusinessStats; currency: string }) {
  const { totals, daily } = data
  const money = (minor: number) => formatMoney(minor, currency)
  const identifiedPct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : null)
  const pct = identifiedPct(totals.identified, totals.visits)
  const pctPrev = identifiedPct(totals.identifiedPrev, totals.visitsPrev)

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Visitas"
          value={totals.visits.toLocaleString('es-AR')}
          change={stats.change(totals.visits, totals.visitsPrev)}
          series={daily.map((d) => ({ day: d.day, value: d.visits }))}
          format={(v) => `${v} visitas`}
        />
        <KpiTile
          label="Clientes distintos"
          value={totals.customers.toLocaleString('es-AR')}
          change={stats.change(totals.customers, totals.customersPrev)}
          series={daily.map((d) => ({ day: d.day, value: d.customers }))}
          format={(v) => `${v} clientes`}
        />
        <KpiTile
          label="Ticket promedio"
          value={totals.avgTicketMinor === null ? '—' : money(totals.avgTicketMinor)}
          change={stats.change(totals.avgTicketMinor, totals.avgTicketPrevMinor)}
          series={daily.map((d) => ({ day: d.day, value: d.avgTicketMinor }))}
          format={money}
        />
        <KpiTile
          label="Visitas con cliente"
          value={pct === null ? '—' : `${pct}%`}
          change={pct === null || pctPrev === null ? null : pct - pctPrev}
          series={daily.map((d) => ({
            day: d.day,
            value: d.visits > 0 ? Math.round((d.identified / d.visits) * 100) : null,
          }))}
          format={(v) => `${v}%`}
        />
      </div>

      <Panel title="Visitas por semana, según de dónde vinieron">
        <WeeklySourceChart rows={data.weekly} />
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Clientes nuevos y los que volvieron">
          <NewReturningChart data={data.newVsReturning} />
        </Panel>
        <Panel title="Qué días viene más gente">
          <WeekdayChart data={data.byWeekday} />
        </Panel>
      </div>
    </>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-5">
      <h2 className="text-[21px] font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  )
}
