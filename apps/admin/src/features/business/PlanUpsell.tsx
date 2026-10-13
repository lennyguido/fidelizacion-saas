import { plans, type PlanFeature, type PlanLimit } from '@plataforma/sdk'
import { useActiveBusiness } from './ActiveBusinessContext'
import { usePlan } from './usePlan'

const SALES_WHATSAPP = import.meta.env.VITE_SALES_WHATSAPP as string | undefined

type Props =
  | { feature: PlanFeature; limit?: never; used?: never; compact?: boolean }
  | { limit: PlanLimit; used: number; feature?: never; compact?: boolean }

/**
 * Función bloqueada por el plan (D-047): se muestra igual, con qué gana el dueño,
 * en qué plan está y cuánto sale, y un botón para pedirlo por WhatsApp.
 * El empleado ve el mismo aviso pero sin botón ("pedíselo al dueño").
 */
export function PlanUpsell(props: Props) {
  const { business } = useActiveBusiness()
  const plan = usePlan()
  if (!plan.data) return null

  const current = plan.data.planId
  const target = props.feature
    ? plans.planWithFeature(current, props.feature)
    : plans.planWithMore(current, props.limit, props.used)
  if (!target) return null

  let title: string
  let benefit: string
  if (props.feature) {
    title = plans.FEATURE_PITCH[props.feature].title
    benefit = plans.FEATURE_PITCH[props.feature].benefit
  } else {
    const max = target.limits[props.limit]
    const label = plans.LIMIT_LABELS[props.limit]
    title = `Llegaste al tope de tu plan`
    benefit =
      max === null
        ? `Con ${target.name} sumás ${label.many} sin límite.`
        : `Con ${target.name} tenés hasta ${max.toLocaleString('es-AR')} ${label.many}.`
  }
  const isOwner = business.role === 'owner'
  const reason = props.feature ? title.toLowerCase() : benefit

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
      data-testid="plan-upsell"
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <LockIcon />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {title}
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              Plan {target.name}
            </span>
          </p>
          {!props.compact && <p className="mt-1 text-sm text-slate-600">{benefit}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {isOwner
              ? `${plans.formatPesos(target.price)} por mes. Se activa en el día.`
              : 'Pedíselo al dueño del negocio.'}
          </p>
        </div>
      </div>
      {isOwner && (
        <a
          href={plans.upgradeLink(target, business.name, reason, SALES_WHATSAPP)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-action px-5 text-sm font-medium text-white hover:bg-action-hover"
        >
          Pasar a {target.name}
        </a>
      )}
    </div>
  )
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mt-0.5 h-5 w-5 shrink-0 text-slate-400"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V8H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 7V5.5a3 3 0 1 0-6 0V8h6Z"
        clipRule="evenodd"
      />
    </svg>
  )
}
