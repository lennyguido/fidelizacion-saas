import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AppError, errorMessage, mobileRedemption, type RedemptionRequest } from '@plataforma/sdk'

/** Estado del canje desde el celular en la tarjeta (D-037). */
export function useMobileRedeem(token: string) {
  const [active, setActive] = useState<RedemptionRequest | null>(null)
  const start = useMutation({
    mutationFn: (rewardId: string) => mobileRedemption.request(token, rewardId),
    onSuccess: setActive,
  })
  const error = start.isError ? redeemErrorMessage(start.error) : null
  return {
    active,
    error,
    pending: start.isPending,
    start: (rewardId: string) => start.mutate(rewardId),
    close: () => {
      setActive(null)
      start.reset()
    },
  }
}

function redeemErrorMessage(error: unknown): string {
  // Si el negocio todavía no tiene el canje desde el celular, la función no existe.
  if (error instanceof AppError && (error.code === 'unknown' || error.code === 'not_found')) {
    return 'Por ahora pedí el canje en la caja.'
  }
  return errorMessage(error)
}
