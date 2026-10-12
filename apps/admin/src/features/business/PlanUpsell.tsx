/** Aviso cuando una función no está en el plan del negocio. */
export function PlanUpsell({ plans }: { plans: string }) {
  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      Disponible en los planes {plans}. Para cambiar de plan, escribinos por WhatsApp desde
      neriva.net.
    </p>
  )
}
