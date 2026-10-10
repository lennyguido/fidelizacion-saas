import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import {
  AUTOMATION_DAYS,
  automations,
  campaigns,
  errorMessage,
  type Automation,
} from '@plataforma/sdk'
import { Alert, Button, Card, Spinner, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { AUTOMATION_INFO } from './automationText'
import { useAutomations, useCampaigns, useInvalidateCampaigns } from './queries'

/** Recuperación automática: qué mensajes se preparan solos cada día (D-031). */
export function AutomationsPage() {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateCampaigns(business.id)
  const list = useAutomations(business.id)
  const base = `/b/${business.slug}/recuperacion`

  const runNow = useMutation({
    mutationFn: () => automations.runNow(business.id),
    onSuccess: async (count) => {
      toast.show(
        count > 0 ? `Listo: ${count} mensajes nuevos para mandar` : 'Hoy no hay mensajes nuevos',
        'success',
      )
      await invalidate()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <section className="flex flex-col gap-4">
      <Link to={base} className="text-sm text-slate-500 hover:underline">← Recuperación</Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automático</h1>
        <p className="text-sm text-slate-600">
          Cada mañana se preparan los mensajes (solo a quienes aceptaron WhatsApp).
        </p>
        <Link to={`${base}/mensajes`} className="text-sm underline">Ver mensajes listos</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={runNow.isPending} onClick={() => runNow.mutate()}>
          Revisar ahora
        </Button>
      </div>
      {list.isPending && <Spinner />}
      {list.error && <Alert tone="error">{errorMessage(list.error)}</Alert>}
      {list.data?.map((automation) => (
        <AutomationCard
          key={`${automation.kind}-${automation.updatedAt ?? ''}`}
          automation={automation}
        />
      ))}
      <AutomaticCampaigns />
    </section>
  )
}

function AutomationCard({ automation }: { automation: Automation }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateCampaigns(business.id)
  const info = AUTOMATION_INFO[automation.kind]
  const range = AUTOMATION_DAYS[automation.kind]
  const [enabled, setEnabled] = useState(automation.enabled)
  const [days, setDays] = useState(String(automation.days))
  const [message, setMessage] = useState(automation.message)
  const [benefit, setBenefit] = useState(automation.benefit ?? '')
  const [controlPct, setControlPct] = useState(String(automation.controlPct))
  const [attributionDays, setAttributionDays] = useState(String(automation.attributionDays))

  const daysNumber = Number(days)
  const daysInvalid =
    !Number.isInteger(daysNumber) || daysNumber < range.min || daysNumber > range.max
  const controlNumber = Number(controlPct)
  const controlInvalid = !Number.isInteger(controlNumber) || controlNumber < 0 || controlNumber > 50
  const windowNumber = Number(attributionDays)
  const windowInvalid = !Number.isInteger(windowNumber) || windowNumber < 1 || windowNumber > 90
  const messageInvalid = message.trim().length < 5
  const invalid = daysInvalid || controlInvalid || windowInvalid || messageInvalid

  const save = useMutation({
    mutationFn: () =>
      automations.save(business.id, automation.kind, {
        enabled,
        days: daysNumber,
        message: message.trim(),
        benefit: benefit.trim() || null,
        controlPct: controlNumber,
        attributionDays: windowNumber,
      }),
    onSuccess: async () => {
      toast.show(`${info.title}: ${enabled ? 'encendida' : 'apagada'}`, 'success')
      await invalidate()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  const example = campaigns.renderPreview(message, {
    nombre: 'Ana',
    negocio: business.name,
    beneficio: benefit,
    cupon: 'K7P2QX',
  })

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{info.title}</h2>
          <p className="text-sm text-slate-600">{info.description}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {enabled ? 'Encendida' : 'Apagada'}
        </label>
      </div>
      <TextField
        label={info.daysLabel}
        inputMode="numeric"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        error={daysInvalid ? `Entre ${range.min} y ${range.max}.` : null}
      />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Mensaje</span>
        <textarea
          aria-label={`Mensaje de ${info.title}`}
          className="min-h-24 rounded-lg border border-slate-300 p-3 text-base"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <span className="text-xs text-slate-500">
          Podés usar {'{nombre}'}, {'{negocio}'}, {'{beneficio}'} y {'{cupon}'}.
        </span>
      </label>
      <TextField
        label="Beneficio (opcional)"
        value={benefit}
        onChange={(e) => setBenefit(e.target.value)}
      />
      <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
        <p className="text-xs font-medium text-green-700">Así le llega a Ana:</p>
        <p className="whitespace-pre-wrap">{example}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Grupo de control (%)"
          inputMode="numeric"
          value={controlPct}
          onChange={(e) => setControlPct(e.target.value)}
          error={controlInvalid ? 'De 0 a 50.' : null}
          hint="Clientes a los que no se les escribe, para comparar."
        />
        <TextField
          label="Días para medir"
          inputMode="numeric"
          value={attributionDays}
          onChange={(e) => setAttributionDays(e.target.value)}
          error={windowInvalid ? 'De 1 a 90.' : null}
          hint="Si vuelve en estos días, cuenta."
        />
      </div>
      <Button loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>
        Guardar
      </Button>
    </Card>
  )
}

const KIND_LABELS = {
  at_risk: 'En riesgo',
  second_visit: 'Segunda visita',
  birthday: 'Cumpleaños',
}

/** Últimas campañas que armó el motor (con sus resultados, como las manuales). */
function AutomaticCampaigns() {
  const { business } = useActiveBusiness()
  const list = useCampaigns(business.id)
  const automatic = (list.data ?? []).filter((campaign) => campaign.automationKind !== null)
  const items = automatic.slice(0, 10)
  if (items.length === 0) return null

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Últimos envíos automáticos</h2>
      <ul className="divide-y divide-slate-100">
        {items.map((campaign) => (
          <li key={campaign.id}>
            <Link
              to={`/b/${business.slug}/recuperacion/campanas/${campaign.id}`}
              className="flex items-center justify-between gap-3 py-2 hover:underline"
            >
              <span className="font-medium">{campaign.name}</span>
              <span className="text-sm text-slate-500">
                {campaignLabel(campaign.automationKind, campaign.recipientsCount)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function campaignLabel(kind: keyof typeof KIND_LABELS | null, count: number): string {
  return `${kind ? KIND_LABELS[kind] : ''} · ${count} clientes`
}
