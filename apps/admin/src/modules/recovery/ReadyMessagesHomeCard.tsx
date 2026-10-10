import { Link } from 'react-router'
import { Card } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useReadyMessagesCount } from './queries'

/** Inicio: "Hoy hay N mensajes listos" (recuperación automática, D-031). */
export function ReadyMessagesHomeCard() {
  const { business } = useActiveBusiness()
  const count = useReadyMessagesCount(business.id)
  const base = `/b/${business.slug}/recuperacion`
  const n = count.data ?? 0

  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Recuperación automática</h2>
        <p className="text-sm text-slate-600">
          {n === 0 ? 'No hay mensajes para mandar.' : `Hoy hay ${n} mensajes listos para mandar.`}
        </p>
      </div>
      <Link
        to={n === 0 ? `${base}/automatico` : `${base}/mensajes`}
        className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        {n === 0 ? 'Configurar' : 'Mandar'}
      </Link>
    </Card>
  )
}
