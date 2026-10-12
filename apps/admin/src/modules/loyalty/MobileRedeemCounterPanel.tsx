import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AppError, errorMessage, mobileRedemption, type FoundRequest } from '@plataforma/sdk'
import { Alert, Button, Card, Spinner, TextField, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../../features/business/ActiveBusinessContext'
import { useInvalidateLoyalty } from './queries'

/**
 * Mostrador: el cliente pidió un premio desde su tarjeta y muestra un código
 * (D-037). Se busca, se ve si le alcanza y se confirma: ahí se descuentan los puntos.
 */
export function MobileRedeemCounterPanel() {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')

  if (!open) {
    return (
      <Button variant="ghost" fullWidth onClick={() => setOpen(true)}>
        ¿Trae un canje desde el celular?
      </Button>
    )
  }

  const close = () => {
    setCode('')
    setOpen(false)
  }

  return (
    <Card className="flex flex-col gap-3">
      <TextField
        label="Código del canje"
        autoFocus
        autoComplete="off"
        placeholder="H4K9PZ"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      <RequestResult code={code} onDone={close} />
      <Button variant="secondary" onClick={close}>
        Cancelar
      </Button>
    </Card>
  )
}

function RequestResult({ code, onDone }: { code: string; onDone: () => void }) {
  const { business } = useActiveBusiness()
  const valid = mobileRedemption.looksLikeRequestCode(code)
  const lookup = useQuery({
    queryKey: ['loyalty', business.id, 'mobile-redeem', code],
    queryFn: () => mobileRedemption.find(business.id, code),
    enabled: valid,
    retry: false,
  })

  if (!valid) return <p className="text-sm text-slate-500">Son 6 letras y números.</p>
  if (lookup.isPending) return <Spinner />
  if (lookup.isError) {
    // Hasta que se active (revisión del mentor) la función no existe en la base.
    const notReady = lookup.error instanceof AppError && lookup.error.code === 'unknown'
    return (
      <Alert tone="error">
        {notReady
          ? 'El canje desde el celular todavía no está activado.'
          : errorMessage(lookup.error)}
      </Alert>
    )
  }
  if (!lookup.data) {
    return <Alert tone="error">No hay un canje vivo con ese código (pudo haber vencido).</Alert>
  }
  return <RequestDetails request={lookup.data} onDone={onDone} />
}

function RequestDetails({ request, onDone }: { request: FoundRequest; onDone: () => void }) {
  const { business } = useActiveBusiness()
  const toast = useToast()
  const invalidate = useInvalidateLoyalty(business.id)
  const confirm = useMutation({
    mutationFn: () => mobileRedemption.confirm(request.requestId),
    onSuccess: async (result) => {
      await invalidate()
      toast.show(`Canje confirmado. Comprobante ${result.code}`, 'success')
      onDone()
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm">
      <p>
        <strong>{request.customerName}</strong> quiere <strong>{request.rewardName}</strong> (
        {request.costPoints} puntos). Tiene {request.pointsBalance}.
      </p>
      {request.enough ? (
        <Button loading={confirm.isPending} onClick={() => confirm.mutate()}>
          Confirmar canje
        </Button>
      ) : (
        <Alert tone="error">No le alcanzan los puntos.</Alert>
      )}
    </div>
  )
}
