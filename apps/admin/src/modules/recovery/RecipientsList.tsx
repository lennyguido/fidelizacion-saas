import { useMutation } from '@tanstack/react-query'
import {
  campaigns,
  errorMessage,
  formatMoney,
  formatPhone,
  type Campaign,
  type CampaignRecipient,
  type RecipientBlockedReason,
} from '@plataforma/sdk'
import { Alert, Card, Spinner, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { whatsappLink } from '../../lib/clientAppUrl'
import { useInvalidateCampaigns, useRecipients } from './queries'

export function RecipientsList({ campaign }: { campaign: Campaign }) {
  const { business } = useActiveBusiness()
  const recipients = useRecipients(business.id, campaign.id, true)

  if (recipients.isPending) return <Spinner />
  if (recipients.isError) return <Alert tone="error">{errorMessage(recipients.error)}</Alert>
  const toContact = recipients.data.filter((r) => !r.isControl)
  const control = recipients.data.filter((r) => r.isControl)

  return (
    <>
      <Card className="flex flex-col gap-2 p-0">
        <h2 className="px-4 pt-4 text-base font-semibold">
          A quiénes escribirles ({toContact.length})
        </h2>
        <p className="px-4 text-xs text-slate-500">
          Tocá "WhatsApp": se abre tu WhatsApp con el mensaje listo. Mandalo y volvé.
        </p>
        <ul className="divide-y divide-slate-100">
          {toContact.map((recipient) => (
            <RecipientRow key={recipient.id} recipient={recipient} />
          ))}
        </ul>
      </Card>
      {control.length > 0 && (
        <Card className="flex flex-col gap-2 p-0">
          <h2 className="px-4 pt-4 text-base font-semibold">Grupo de control ({control.length})</h2>
          <p className="px-4 text-xs text-slate-500">
            A estos clientes NO les escribas: sirven para comparar y saber si el mensaje funcionó.
          </p>
          <ul className="divide-y divide-slate-100">
            {control.map((recipient) => (
              <li key={recipient.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>{recipient.name}</span>
                <Returned recipient={recipient} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function RecipientRow({ recipient }: { recipient: CampaignRecipient }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateCampaigns(business.id)
  const contacted = useMutation({
    mutationFn: () => campaigns.markContacted(recipient.id),
    onSuccess: invalidate,
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{recipient.name}</p>
        <p className="truncate text-sm text-slate-500">
          {recipient.blockedReason ? '' : formatPhone(recipient.phone)}
          {recipient.contactedAt ? ' · mensaje enviado' : ''}
        </p>
        {recipient.couponCode && (
          <p className="text-xs text-slate-500">
            Cupón {recipient.couponCode}{recipient.couponRedeemedAt ? ' · usado' : ''}
          </p>
        )}
        <Returned recipient={recipient} />
      </div>
      {recipient.blockedReason ? (
        <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {BLOCKED_LABELS[recipient.blockedReason]}
        </span>
      ) : (
        <WhatsAppButton recipient={recipient} onOpen={() => contacted.mutate()} />
      )}
    </li>
  )
}

/** Ya no hay que escribirle: se dio de baja o se archivó después de lanzar. */
const BLOCKED_LABELS: Record<RecipientBlockedReason, string> = {
  consent_revoked: 'No quiere mensajes',
  customer_inactive: 'Cliente archivado',
}

function WhatsAppButton({
  recipient,
  onOpen,
}: {
  recipient: CampaignRecipient
  onOpen: () => void
}) {
  return (
    <a
      href={whatsappLink(recipient.phone, recipient.message ?? '')}
      target="_blank"
      rel="noreferrer"
      onClick={onOpen}
      className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
        recipient.contactedAt
          ? 'text-green-700 ring-1 ring-inset ring-green-600'
          : 'bg-green-600 text-white hover:bg-green-500'
      }`}
    >
      {recipient.contactedAt ? 'Reenviar' : 'WhatsApp'}
    </a>
  )
}

function Returned({ recipient }: { recipient: CampaignRecipient }) {
  const { business } = useActiveBusiness()
  if (!recipient.returnedAt) return null
  return (
    <p className="text-sm font-medium text-green-700">
      Volvió · {formatMoney(recipient.returnedAmountMinor, business.currency)}
    </p>
  )
}
