import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { mobileRedemption, type RedemptionRequest } from '@plataforma/sdk'

/**
 * Canje desde el celular (D-037): muestra el código (y su QR) para el cajero,
 * cuenta los 5 minutos y consulta cada 3 segundos hasta que se confirme.
 */
export function MobileRedeem({
  token,
  request,
  onClose,
}: {
  token: string
  request: RedemptionRequest
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const seconds = useSecondsLeft(request.expiresAt)
  const state = useQuery({
    queryKey: ['redemption-request', request.requestId],
    queryFn: () => mobileRedemption.getState(token, request.requestId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  })
  const status = state.data?.status ?? 'pending'

  useEffect(() => {
    if (status === 'confirmed') void queryClient.invalidateQueries({ queryKey: ['card', token] })
  }, [status, queryClient, token])

  return (
    <section
      className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-sm"
      data-testid="mobile-redeem"
    >
      {status === 'confirmed' ? (
        <>
          <p className="text-2xl font-bold text-green-700">¡Canjeado!</p>
          <p className="text-sm text-slate-600">
            {request.rewardName}. Comprobante:{' '}
            <strong className="font-mono">{state.data?.redemptionCode}</strong>
          </p>
        </>
      ) : status === 'pending' && seconds > 0 ? (
        <>
          <p className="font-semibold">Mostrale este código al cajero</p>
          <p className="text-sm text-slate-600">{request.rewardName}</p>
          <CodeQr code={request.code} />
          <p className="font-mono text-3xl font-bold tracking-[0.3em]">{request.code}</p>
          <p className="text-xs text-slate-500">
            Vence en {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          {status === 'replaced'
            ? 'Pediste otro canje: usá el código nuevo.'
            : 'El código venció. Si todavía lo querés, pedilo de nuevo.'}
        </p>
      )}
      <button type="button" onClick={onClose} className="text-xs text-slate-500 underline">
        Cerrar
      </button>
    </section>
  )
}

function useSecondsLeft(expiresAt: string): number {
  const [seconds, setSeconds] = useState(() => mobileRedemption.secondsLeft(expiresAt))
  useEffect(() => {
    const id = window.setInterval(() => setSeconds(mobileRedemption.secondsLeft(expiresAt)), 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])
  return seconds
}

function CodeQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(code, { margin: 1, width: 200, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null))
    return () => {
      cancelled = true
    }
  }, [code])
  return src ? (
    <img src={src} alt={`Código QR del canje ${code}`} className="h-40 w-40" />
  ) : (
    <div className="h-40 w-40 rounded-lg bg-slate-100" aria-hidden />
  )
}
