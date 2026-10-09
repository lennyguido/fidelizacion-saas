import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  errorMessage,
  formatMoney,
  loyalty,
  parseAmountToMinor,
  type LoyaltyProgram,
  type LoyaltyProgramKind,
} from '@plataforma/sdk'
import { Alert, Button, Card, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useInvalidateLoyalty } from './queries'

const DEFAULT_PROGRAM: Omit<LoyaltyProgram, 'businessId'> = {
  enabled: true,
  kind: 'points',
  pointsPerVisit: 1,
  pointsPerAmount: 0,
  amountStepMinor: null,
  minAmountMinor: 0,
}

/** Muestra la regla del programa; dueño/admin la pueden editar. */
export function ProgramCard({ program }: { program: LoyaltyProgram | null }) {
  const { business } = useActiveBusiness()
  const canManage = business.role !== 'staff'
  const [editing, setEditing] = useState(!program && canManage)
  const money = (minor: number) => formatMoney(minor, business.currency)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Regla del programa</h2>
          {program ? (
            <p className="mt-1 text-sm text-slate-600">
              {program.enabled ? loyalty.describeProgram(program, money) : 'Programa pausado'}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Todavía no configuraste el programa.</p>
          )}
        </div>
        {canManage && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {program ? 'Cambiar' : 'Configurar'}
          </Button>
        )}
      </div>
      {editing && (
        <ProgramForm
          initial={program ?? { businessId: business.id, ...DEFAULT_PROGRAM }}
          onDone={() => setEditing(false)}
        />
      )}
    </Card>
  )
}

function minorToInput(minor: number | null): string {
  return minor ? String(Math.round(minor / 100)) : ''
}

function ProgramForm({ initial, onDone }: { initial: LoyaltyProgram; onDone: () => void }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const [kind, setKind] = useState<LoyaltyProgramKind>(initial.kind)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [perVisit, setPerVisit] = useState(String(initial.pointsPerVisit))
  const [perAmount, setPerAmount] = useState(String(initial.pointsPerAmount))
  const [step, setStep] = useState(minorToInput(initial.amountStepMinor))
  const [minimum, setMinimum] = useState(minorToInput(initial.minAmountMinor))
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (input: Omit<LoyaltyProgram, 'businessId'>) =>
      loyalty.saveProgram(business.id, input),
    onSuccess: async () => {
      await invalidate()
      toast.show('Programa guardado', 'success')
      onDone()
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const pointsPerVisit = Number(perVisit || 0)
    const pointsPerAmount = Number(perAmount || 0)
    const amountStepMinor = step ? parseAmountToMinor(step) : null
    const minAmountMinor = minimum ? parseAmountToMinor(minimum) : 0
    if (!Number.isInteger(pointsPerVisit) || !Number.isInteger(pointsPerAmount)) {
      return setError('Los puntos tienen que ser números enteros.')
    }
    if (pointsPerVisit <= 0 && pointsPerAmount <= 0) {
      return setError('El programa tiene que dar puntos por visita, por compra o por las dos.')
    }
    if (pointsPerAmount > 0 && !amountStepMinor) {
      return setError('Indicá cada cuánto dinero se dan los puntos por compra.')
    }
    if (minAmountMinor === null) return setError('Revisá la compra mínima.')
    save.mutate({ enabled, kind, pointsPerVisit, pointsPerAmount, amountStepMinor, minAmountMinor })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 font-medium text-slate-700">Cómo se muestra</legend>
        {(['points', 'stamps'] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="kind"
              checked={kind === value}
              onChange={() => setKind(value)}
            />
            {value === 'points' ? 'Puntos' : 'Tarjeta de sellos'}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Por cada visita"
          inputMode="numeric"
          value={perVisit}
          onChange={(e) => setPerVisit(e.target.value)}
          hint="0 si solo querés dar por compra."
        />
        <TextField
          label="Por compra: puntos"
          inputMode="numeric"
          value={perAmount}
          onChange={(e) => setPerAmount(e.target.value)}
          hint="0 si no querés dar por compra."
        />
        <TextField
          label="Por compra: cada $"
          inputMode="decimal"
          value={step}
          onChange={(e) => setStep(e.target.value)}
          placeholder="1.000"
        />
        <TextField
          label="Compra mínima $ (opcional)"
          inputMode="decimal"
          value={minimum}
          onChange={(e) => setMinimum(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Programa activo (si lo pausás, las visitas no suman puntos)
      </label>
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          Guardar programa
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
