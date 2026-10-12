import { Card } from '@plataforma/ui'
import { usePlan } from './usePlan'

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
        <p className="text-sm text-slate-600">
          Para cambiar de plan, escribinos por WhatsApp desde neriva.net.
        </p>
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
