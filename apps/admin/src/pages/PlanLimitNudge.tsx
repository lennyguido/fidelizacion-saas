import { plans } from '@plataforma/sdk'
import { usePlan } from '../features/business/usePlan'
import { PlanUpsell } from '../features/business/PlanUpsell'

/**
 * Inicio (dueño/admin): cuando faltan pocos clientes para el tope del plan
 * (80 % o más), se avisa con tiempo y se ofrece el plan siguiente (D-047).
 * Un solo aviso, y solo cuando importa: no es una publicidad permanente.
 */
export function PlanLimitNudge() {
  const plan = usePlan()
  if (!plan.data) return null
  const used = plan.data.usage.customers
  const near = plans.isNearLimit(plan.data, 'maxCustomers', used)
  const full = plans.isAtLimit(plan.data, 'maxCustomers', used)
  if (!near && !full) return null
  const max = plan.data.features.maxCustomers ?? 0

  return (
    <div className="flex flex-col gap-2" data-testid="plan-limit-nudge">
      <p className="text-sm font-medium text-slate-700">
        {full
          ? `Llegaste a ${max.toLocaleString('es-AR')} clientes: no se pueden cargar más con tu plan.`
          : `Ya tenés ${used.toLocaleString('es-AR')} de ${max.toLocaleString('es-AR')} clientes de tu plan.`}
      </p>
      <PlanUpsell limit="maxCustomers" used={used} compact />
    </div>
  )
}
