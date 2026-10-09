import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { campaigns, errorMessage, type CustomerStatus, type Segment } from '@plataforma/sdk'
import { Alert, Button, Card, TextField } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { RECOVERY_MODULE, useInvalidateCampaigns, useSegmentPreview } from './queries'

const AUDIENCES: Array<{ id: string; label: string; statuses: CustomerStatus[] }> = [
  { id: 'risk', label: 'En riesgo (dejaron de venir hace poco)', statuses: ['AT_RISK'] },
  { id: 'inactive', label: 'Inactivos (hace mucho que no vienen)', statuses: ['INACTIVE'] },
  { id: 'both', label: 'En riesgo + inactivos', statuses: ['AT_RISK', 'INACTIVE'] },
]

function buildSegment(audience: string, minVisits: string): Segment {
  return {
    statuses: AUDIENCES.find((a) => a.id === audience)?.statuses ?? ['AT_RISK'],
    min_visits: Number(minVisits) || 0,
  }
}

const DEFAULT_MESSAGE =
  '¡Hola {nombre}! Hace un tiempo que no te vemos por {negocio}. Esta semana tenés {beneficio}. ¡Te esperamos!'

export function NewCampaignPage() {
  const { business } = useActiveBusiness()
  const navigate = useNavigate()
  const invalidate = useInvalidateCampaigns(business.id)
  const [name, setName] = useState('Te extrañamos')
  const [audience, setAudience] = useState('risk')
  const [minVisits, setMinVisits] = useState('2')
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [benefit, setBenefit] = useState('un 10% de descuento')
  const [controlPct, setControlPct] = useState('20')
  const [days, setDays] = useState('14')
  const [error, setError] = useState<string | null>(null)

  const segment = buildSegment(audience, minVisits)
  const preview = useSegmentPreview(
    business.id,
    buildSegment(audience, useDebouncedValue(minVisits)),
  )

  const create = useMutation({
    mutationFn: () =>
      campaigns.create(business.id, {
        moduleId: RECOVERY_MODULE,
        name,
        segment,
        message,
        benefit: benefit.trim() || null,
        controlPct: Number(controlPct),
        attributionDays: Number(days),
      }),
    onSuccess: async (campaign) => {
      await invalidate()
      navigate(`/b/${business.slug}/recuperacion/campanas/${campaign.id}`)
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Poné un nombre para reconocer la campaña.')
    if (message.trim().length < 5) return setError('Escribí el mensaje.')
    const pct = Number(controlPct)
    if (!Number.isInteger(pct) || pct < 0 || pct > 50) {
      return setError('El grupo de control va de 0% a 50%.')
    }
    const windowDays = Number(days)
    if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 90) {
      return setError('La ventana va de 1 a 90 días.')
    }
    create.mutate()
  }

  const example = campaigns.renderPreview(message, {
    nombre: 'Ana',
    negocio: business.name,
    beneficio: benefit,
  })

  return (
    <section className="flex flex-col gap-4">
      <Link
        to={`/b/${business.slug}/recuperacion`}
        className="text-sm text-slate-500 hover:underline"
      >
        ← Recuperación
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Nueva campaña</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Card className="flex flex-col gap-4">
          <TextField
            label="Nombre de la campaña"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium text-slate-700">¿A quién le escribimos?</legend>
            {AUDIENCES.map((option) => (
              <label key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audience"
                  checked={audience === option.id}
                  onChange={() => setAudience(option.id)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <TextField
            label="Que hayan venido al menos (veces)"
            inputMode="numeric"
            value={minVisits}
            onChange={(e) => setMinVisits(e.target.value)}
          />
          <p className="rounded-lg bg-slate-50 p-3 text-sm" data-testid="segment-preview">
            {preview.data
              ? `${preview.data.matching} clientes entran en este grupo; ${preview.data.reachable} tienen teléfono y aceptaron WhatsApp.`
              : 'Calculando…'}
          </p>
        </Card>

        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Mensaje</span>
            <textarea
              className="min-h-28 rounded-lg border border-slate-300 p-3 text-base"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <span className="text-xs text-slate-500">
              Podés usar {'{nombre}'}, {'{negocio}'} y {'{beneficio}'}.
            </span>
          </label>
          <TextField
            label="Beneficio (opcional)"
            value={benefit}
            onChange={(e) => setBenefit(e.target.value)}
          />
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
            <p className="text-xs font-medium text-green-700">Así le llega a Ana:</p>
            {example}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Cómo medimos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Grupo de control (%)"
              inputMode="numeric"
              value={controlPct}
              onChange={(e) => setControlPct(e.target.value)}
              hint="A este % (elegido al azar) NO se le escribe. Así sabemos cuántos volvieron gracias al mensaje."
            />
            <TextField
              label="Contar vueltas durante (días)"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
        </Card>

        <div>
          <Button type="submit" size="lg" loading={create.isPending}>
            Guardar y revisar
          </Button>
        </div>
      </form>
    </section>
  )
}
