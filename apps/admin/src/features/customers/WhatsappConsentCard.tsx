import { useMutation, useQuery } from '@tanstack/react-query'
import { customers, errorMessage } from '@plataforma/sdk'
import { Button, Card, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { formatDateTime } from '../../lib/format'
import { customerKeys } from './queries'

/** Si el cliente aceptó que el negocio le escriba por WhatsApp (Ley 25.326). */
export function WhatsappConsentCard({
  customerId,
  hasPhone,
}: {
  customerId: string
  hasPhone: boolean
}) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const consent = useQuery({
    queryKey: [...customerKeys.detail(business.id, customerId), 'consent'],
    queryFn: () => customers.getWhatsappConsent(customerId),
  })
  const save = useMutation({
    mutationFn: (granted: boolean) =>
      customers.setWhatsappConsent(business.id, customerId, granted),
    onSuccess: async (_data, granted) => {
      await consent.refetch()
      toast.show(granted ? 'Anotado: acepta WhatsApp' : 'Anotado: no quiere WhatsApp', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  if (consent.isPending) return null
  const current = consent.data ?? null
  const granted = current?.granted

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Mensajes por WhatsApp</h2>
      <p className="text-sm text-slate-600" data-testid="whatsapp-consent">
        {granted === undefined
          ? 'Todavía no le preguntaste si acepta que el negocio le escriba.'
          : granted
            ? `Acepta mensajes (desde ${formatDateTime(current?.recordedAt ?? '', business.timezone)}).`
            : 'No quiere recibir mensajes. No le escribas.'}
      </p>
      {!hasPhone && (
        <p className="text-xs text-slate-500">Sin teléfono cargado no se le puede escribir.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {granted !== true && (
          <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate(true)}>
            Acepta WhatsApp
          </Button>
        )}
        {granted !== false && (
          <Button variant="ghost" loading={save.isPending} onClick={() => save.mutate(false)}>
            No quiere mensajes
          </Button>
        )}
      </div>
    </Card>
  )
}
