import { useQuery } from '@tanstack/react-query'
import { card as cardApi, errorMessage, formatMoney, loyalty, type Card } from '@plataforma/sdk'
import { Spinner } from '@plataforma/ui'
import { MemberQr } from './MemberQr'
import { Movements } from './Movements'
import { NoCard } from './NoCard'
import { Rewards } from './Rewards'

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
  const brand = card.business.primaryColor ?? '#0f172a'
  const unit = card.program?.kind === 'stamps' ? 'sellos' : 'puntos'
  const money = (minor: number) => formatMoney(minor, card.business.currency)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-10">
      <header className="rounded-2xl p-5 text-white shadow" style={{ backgroundColor: brand }}>
        <p className="text-sm opacity-80">{card.business.name}</p>
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

      <Rewards card={card} unit={unit} />
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
