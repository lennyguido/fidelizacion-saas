import { useQuery } from '@tanstack/react-query'
import {
  businesses,
  card as cardApi,
  errorMessage,
  formatMoney,
  isValidHexColor,
  loyalty,
  textColorOn,
  type Card,
} from '@plataforma/sdk'
import { Spinner } from '@plataforma/ui'
import { MemberQr } from './MemberQr'
import { Movements } from './Movements'
import { NoCard } from './NoCard'
import { Rewards } from './Rewards'
import { useDocumentBranding } from './useDocumentBranding'

export function CardPage({ token, onForget }: { token: string; onForget: () => void }) {
  const query = useQuery({
    queryKey: ['card', token],
    queryFn: () => cardApi.getCard(token),
    refetchInterval: 60_000,
  })

  if (query.isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </main>
    )
  }
  if (query.isError) return <NoCard message={errorMessage(query.error)} />
  if (!query.data) {
    return (
      <NoCard message="Este link ya no funciona (puede que el negocio te haya mandado uno nuevo). Pedí el link actualizado en la caja." />
    )
  }
  return <CardView card={query.data} onForget={onForget} />
}

function CardView({ card, onForget }: { card: Card; onForget: () => void }) {
  const color = card.business.primaryColor
  const brand = color && isValidHexColor(color) ? color : '#0f172a'
  const logo = businesses.logoUrl(card.business.logoPath)
  useDocumentBranding(card.business.name, brand)
  const unit = card.program?.kind === 'stamps' ? 'sellos' : 'puntos'
  const money = (minor: number) => formatMoney(minor, card.business.currency)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-10">
      <header
        className="rounded-2xl p-5 shadow"
        style={{ backgroundColor: brand, color: textColorOn(brand) }}
      >
        <div className="mb-2 flex items-center gap-3">
          {logo && (
            <img
              src={logo}
              alt={`Logo de ${card.business.name}`}
              className="h-10 w-10 rounded-lg bg-white object-contain p-0.5"
            />
          )}
          <p className="text-sm opacity-80" data-testid="card-business">
            {card.business.name}
          </p>
        </div>
        <h1 className="text-xl font-semibold">Hola, {card.firstName}</h1>
        <p className="mt-4">
          <span className="text-5xl font-bold" data-testid="card-balance">
            {card.pointsBalance}
          </span>{' '}
          <span className="opacity-90">{unit}</span>
        </p>
        {card.program && card.program.enabled && (
          <p className="mt-2 text-sm opacity-90">
            Sumás {loyalty.describeProgram(card.program, money)}.
          </p>
        )}
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <MemberQr code={card.memberCode} />
      </section>

      <Rewards card={card} unit={unit} brand={brand} />
      <Movements movements={card.movements} />

      <button
        type="button"
        onClick={onForget}
        className="mt-4 self-center text-xs text-slate-400 underline"
      >
        Olvidar esta tarjeta en este teléfono
      </button>
    </main>
  )
}
