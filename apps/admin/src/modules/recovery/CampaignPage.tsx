import { Link, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { campaigns, errorMessage, type Campaign } from '@plataforma/sdk'
import { Alert, Button, Card, FullPageSpinner, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { formatDateTime } from '../../lib/format'
import { CampaignResultsCard } from './CampaignResultsCard'
import { busyText } from './previewText'
import { RecipientsList } from './RecipientsList'
import { useCampaign, useInvalidateCampaigns, useSegmentPreview } from './queries'

export function CampaignPage() {
  const { campaignId = '' } = useParams()
  const { business } = useActiveBusiness()
  const campaign = useCampaign(business.id, campaignId)

  if (campaign.isPending) return <FullPageSpinner />
  if (campaign.isError) return <Alert tone="error">{errorMessage(campaign.error)}</Alert>
  const data = campaign.data

  return (
    <section className="flex flex-col gap-4">
      <Link
        to={`/b/${business.slug}/recuperacion`}
        className="text-sm text-slate-500 hover:underline"
      >
        ← Recuperación
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
        <p className="text-sm text-slate-500">
          {data.status === 'sent' && data.sentAt
            ? `Lanzada el ${formatDateTime(data.sentAt, business.timezone)} · ${data.recipientsCount} clientes`
            : data.status === 'cancelled'
              ? 'Cancelada'
              : 'Borrador'}
        </p>
      </div>
      {data.status === 'draft' && <DraftActions campaign={data} />}
      {data.status === 'sent' && (
        <>
          <CampaignResultsCard campaign={data} />
          <RecipientsList campaign={data} />
        </>
      )}
    </section>
  )
}

function DraftActions({ campaign }: { campaign: Campaign }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateCampaigns(business.id)
  const preview = useSegmentPreview(business.id, campaign.segment)
  const launch = useMutation({
    mutationFn: () => campaigns.launch(campaign.id),
    onSuccess: async () => {
      await invalidate()
      toast.show('Campaña lanzada: ahora mandá los mensajes', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const cancel = useMutation({
    mutationFn: () => campaigns.cancel(campaign.id),
    onSuccess: invalidate,
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const reachable = preview.data?.reachable ?? 0
  const busy = preview.data?.busy ?? 0
  const control = Math.floor((reachable * campaign.controlPct) / 100)

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm">{campaign.message}</p>
      <p className="rounded-lg bg-slate-50 p-3 text-sm">
        {preview.data
          ? `Van a quedar ${reachable} clientes: a ${reachable - control} les escribís y ${control} quedan como grupo de control (no se les escribe, para comparar).${busyText(busy)}`
          : 'Calculando…'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          loading={launch.isPending}
          disabled={reachable === 0}
          onClick={() => launch.mutate()}
        >
          Lanzar campaña
        </Button>
        <Button variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate()}>
          Cancelar
        </Button>
      </div>
      {preview.data && reachable === 0 && busy === 0 && (
        <Alert>
          Nadie de este grupo aceptó WhatsApp todavía. Anotalo en la ficha de cada cliente
          ("Mensajes por WhatsApp").
        </Alert>
      )}
    </Card>
  )
}
