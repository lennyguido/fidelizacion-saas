import { plans, type CatalogPlan, type PlanInfo } from '@plataforma/sdk'
import { Card } from '@plataforma/ui'
import { useActiveBusiness } from './ActiveBusinessContext'
import { usePlan } from './usePlan'

const SALES_WHATSAPP = import.meta.env.VITE_SALES_WHATSAPP as string | undefined

const FEATURES = [
  { key: 'automations', label: 'Recuperación automática' },
  { key: 'selfSignup', label: 'Alta por QR' },
  { key: 'cashRegister', label: 'Conexión con la caja' },
] as const

/** Mi negocio: qué incluye el plan y cuánto se usa de cada límite. */
export function PlanCard() {
  const plan = usePlan()
  if (!plan.data) return null
  const { name, features, usage } = plan.data

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Tu plan: {name}</h2>
      </div>
      <ul className="grid gap-2 text-sm sm:grid-cols-3">
        {FEATURES.map((item) => (
          <li key={item.key} className={features[item.key] ? '' : 'text-slate-400'}>
            {features[item.key] ? '✓' : '✕'} {item.label}
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <Usage label="Clientes" used={usage.customers} max={features.maxCustomers} />
        <Usage label="Equipo" used={usage.staff} max={features.maxStaff} />
        <Usage label="Sucursales" used={usage.locations} max={features.maxLocations} />
      </dl>
      <NextPlan current={plan.data} />
    </Card>
  )
}

function Usage({ label, used, max }: { label: string; used: number; max: number | null }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold">
        {used}
        {max === null ? '' : ` de ${max}`}
      </dd>
    </div>
  )
}

/** Lo que suma el plan siguiente, con el botón para pedirlo (D-047). */
function NextPlan({ current }: { current: PlanInfo }) {
  const { business } = useActiveBusiness()
  const index = plans.PLAN_CATALOG.findIndex((p) => p.id === current.planId)
  if (index === -1) return null
  const next: CatalogPlan | undefined = plans.PLAN_CATALOG[index + 1]
  if (!next) return null

  const gains: string[] = []
  for (const key of ['automations', 'selfSignup', 'cashRegister'] as const) {
    if (next.features[key] && !current.features[key]) gains.push(plans.FEATURE_PITCH[key].title)
  }
  for (const key of ['maxCustomers', 'maxStaff', 'maxLocations'] as const) {
    const max = next.limits[key]
    const label = plans.LIMIT_LABELS[key].many
    if (max === null) gains.push(`${label} sin límite`)
    else if (current.features[key] !== null && max > (current.features[key] ?? 0))
      gains.push(`hasta ${max.toLocaleString('es-AR')} ${label}`)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4" data-testid="next-plan">
      <p className="text-sm font-semibold">
        Con {next.name} ({plans.formatPesos(next.price)}/mes) sumás:
      </p>
      <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
        {gains.map((gain) => (
          <li key={gain}>+ {gain}</li>
        ))}
      </ul>
      {business.role === 'owner' ? (
        <a
          href={plans.upgradeLink(next, business.name, 'tener más funciones', SALES_WHATSAPP)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 w-fit items-center rounded-full bg-action px-5 text-sm font-medium text-white hover:bg-action-hover"
        >
          Pasar a {next.name}
        </a>
      ) : (
        <p className="text-xs text-slate-500">Para cambiar de plan, pedíselo al dueño.</p>
      )}
    </div>
  )
}
