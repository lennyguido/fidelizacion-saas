import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import {
  automations,
  errorMessage,
  type OutboxBlockedReason,
  type OutboxMessage,
} from '@plataforma/sdk'
import { Alert, Button, Card, EmptyState, Spinner, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { whatsappLink } from '../../lib/clientAppUrl'
import { AUTOMATION_INFO } from './automationText'
import { useInvalidateCampaigns, useReadyMessages } from './queries'

/** Mensajes que la recuperación automática dejó listos: uno por toque de wa.me. */
export function OutboxPage() {
  const { business } = useActiveBusiness()
  const list = useReadyMessages(business.id)
  const base = `/b/${business.slug}/recuperacion`

  return (
    <section className="flex flex-col gap-4">
      <Link to={base} className="text-sm text-slate-500 hover:underline">
        ← Recuperación
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mensajes listos</h1>
        <p className="text-sm text-slate-600">
          Tocá "WhatsApp": se abre tu WhatsApp con el mensaje armado. Mandalo y volvé.
        </p>
        <Link to={`${base}/automatico`} className="text-sm underline">
          Configurar qué mensajes se preparan
        </Link>
      </div>
      {list.isPending && <Spinner />}
      {list.error && <Alert tone="error">{errorMessage(list.error)}</Alert>}
      {list.data && list.data.length === 0 && (
        <EmptyState
          title="No hay mensajes para mandar"
          description="Cuando haya clientes para escribirles, aparecen acá a la mañana."
        />
      )}
      {list.data && list.data.length > 0 && (
        <Card className="flex flex-col gap-2 p-0">
          <h2 className="px-4 pt-4 text-base font-semibold">Para mandar ({list.data.length})</h2>
          <ul className="divide-y divide-slate-100">
            {list.data.map((item) => (
              <MessageRow key={item.id} item={item} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}

/** Ya no hay que escribirle: se dio de baja o se archivó después de preparar el mensaje. */
const BLOCKED_LABELS: Record<OutboxBlockedReason, string> = {
  consent_revoked: 'No quiere mensajes',
  customer_inactive: 'Cliente archivado',
}

function MessageRow({ item }: { item: OutboxMessage }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateCampaigns(business.id)
  const sent = useMutation({
    mutationFn: () => automations.markSent(item.id),
    onSuccess: invalidate,
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const discard = useMutation({
    mutationFn: () => automations.discard(item.id),
    onSuccess: invalidate,
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{item.name}</p>
          <p className="text-xs text-slate-500">
            {item.automationKind ? AUTOMATION_INFO[item.automationKind].title : 'Campaña'}
          </p>
        </div>
        {item.blockedReason ? (
          <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            {BLOCKED_LABELS[item.blockedReason]}
          </span>
        ) : (
          <a
            href={whatsappLink(item.phone, item.message ?? '')}
            target="_blank"
            rel="noreferrer"
            onClick={() => sent.mutate()}
            className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
          >
            WhatsApp
          </a>
        )}
      </div>
      {item.message && <p className="text-sm text-slate-600">{item.message}</p>}
      <div>
        <Button
          variant="ghost"
          loading={discard.isPending}
          onClick={() => discard.mutate()}
          aria-label={`Descartar el mensaje para ${item.name}`}
        >
          Descartar
        </Button>
      </div>
    </li>
  )
}
