import type { CardMovement } from '@plataforma/sdk'

const labels: Record<CardMovement['reason'], string> = {
  visit: 'Visita',
  visit_voided: 'Visita anulada',
  redemption: 'Canje',
  redemption_cancelled: 'Canje devuelto',
  adjustment: 'Ajuste del negocio',
}

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

export function Movements({ movements }: { movements: CardMovement[] }) {
  if (movements.length === 0) return null
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">Últimos movimientos</h2>
      <ul className="divide-y divide-slate-100 text-sm">
        {movements.map((movement, index) => (
          <li key={`${movement.createdAt}-${index}`} className="flex justify-between py-2">
            <span className="text-slate-600">
              {labels[movement.reason]}
              <span className="ml-2 text-slate-400">
                {dateFormat.format(new Date(movement.createdAt))}
              </span>
            </span>
            <span className={movement.delta > 0 ? 'font-medium text-green-700' : 'font-medium'}>
              {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
