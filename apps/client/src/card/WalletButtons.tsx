import { useMutation, useQuery } from '@tanstack/react-query'
import { wallet, type WalletProvider } from '@plataforma/sdk'

/** Ícono de billetera (dibujo propio, sin marcas de terceros). */
function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6 6 15.5 3.4a1.5 1.5 0 0 1 1.9 1.1L17.8 6"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect x="14" y="10.5" width="7" height="4" rx="2" fill="currentColor" />
    </svg>
  )
}

const LABELS: Record<WalletProvider, string> = {
  google: 'Agregar a Google Wallet',
  apple: 'Agregar a Apple Wallet',
}

/**
 * Botones para guardar la tarjeta en la billetera del teléfono. Solo aparecen las
 * billeteras que el negocio tiene configuradas (GET /wallet/status).
 */
export function WalletButtons({ token }: { token: string }) {
  const status = useQuery({
    queryKey: ['wallet-status'],
    queryFn: () => wallet.getWalletStatus(),
    staleTime: 60 * 60_000,
    retry: false,
  })
  const save = useMutation({
    mutationFn: (provider: WalletProvider) => wallet.walletSaveUrl(provider, token),
    onSuccess: (url) => window.location.assign(url),
  })

  const providers = (['google', 'apple'] as const).filter((p) => status.data?.[p])
  if (providers.length === 0) return null

  return (
    <section className="flex flex-col items-center gap-2" data-testid="wallet-buttons">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(provider)}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white shadow-sm disabled:opacity-60"
        >
          <WalletIcon />
          {save.isPending && save.variables === provider ? 'Abriendo…' : LABELS[provider]}
        </button>
      ))}
      {save.isError && (
        <p role="alert" className="text-center text-sm text-red-600">
          {wallet.walletErrorMessage(save.error)}
        </p>
      )}
    </section>
  )
}
