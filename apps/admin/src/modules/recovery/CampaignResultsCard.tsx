import { errorMessage, formatMoney, type Campaign } from '@plataforma/sdk'
import { Alert, Card, Spinner } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { formatDateTime } from '../../lib/format'
import { useResults } from './queries'

const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`)

/** Resultados honestos: cuántos volvieron y cuántos de esos se deben al mensaje. */
export function CampaignResultsCard({ campaign }: { campaign: Campaign }) {
  const { business } = useActiveBusiness()
  const results = useResults(business.id, campaign.id, true)
  const money = (minor: number | null) => formatMoney(minor, business.currency)

  if (results.isPending) return <Spinner />
  if (results.isError) return <Alert tone="error">{errorMessage(results.error)}</Alert>
  const r = results.data

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Resultados</h2>
        <p className="text-xs text-slate-500">
          {r.windowOpen
            ? `Se siguen contando vueltas hasta el ${formatDateTime(r.windowEndsAt, business.timezone)}.`
            : `Resultado final (ventana cerrada el ${formatDateTime(r.windowEndsAt, business.timezone)}).`}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Mensajes enviados" value={`${r.contactedCount} de ${r.treatmentCount}`} />
        <Tile
          label="Volvieron (les escribiste)"
          value={`${r.treatmentReturned}`}
          hint={pct(r.treatmentRate)}
        />
        <Tile
          label="Volvieron (control)"
          value={r.controlCount > 0 ? `${r.controlReturned}` : '—'}
          hint={r.controlCount > 0 ? pct(r.controlRate) : 'sin grupo de control'}
        />
        <Tile label="Gastaron los que volvieron" value={money(r.treatmentRevenueMinor)} />
      </dl>
      {r.incrementalRevenueMinor === null ? (
        <Alert>
          Sin grupo de control no se puede saber cuántos hubieran vuelto igual. En la próxima
          campaña dejá al menos un 10%.
        </Alert>
      ) : (
        <div className="rounded-lg bg-green-50 p-4" data-testid="incremental">
          <p className="text-sm text-green-800">Gracias a la campaña (estimado):</p>
          <p className="text-2xl font-bold text-green-800">
            {money(Math.max(0, r.incrementalRevenueMinor))} ·{' '}
            {Math.max(0, Math.round(r.incrementalCustomers ?? 0))} clientes
          </p>
          <p className="mt-1 text-xs text-green-700">
            Comparamos con el grupo de control: lo que gastaron de más los que recibieron el
            mensaje.
            {r.incrementalRevenueMinor < 0 ? ' Por ahora el grupo de control viene mejor.' : ''}
          </p>
        </div>
      )}
    </Card>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-bold">{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  )
}
