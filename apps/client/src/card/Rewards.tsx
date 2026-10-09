import { card as cardApi, type Card } from '@plataforma/sdk'

export function Rewards({ card, unit, brand }: { card: Card; unit: string; brand: string }) {
  if (card.rewards.length === 0) return null
  const next = cardApi.nextReward(card)

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">Recompensas</h2>
      {next && (
        <div className="mb-4">
          <p className="text-sm text-slate-600">
            Te faltan <strong>{next.costPoints - card.pointsBalance}</strong> {unit} para{' '}
            <strong>{next.name}</strong>
          </p>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full"
              style={{
                backgroundColor: brand,
                width: `${Math.min(100, (card.pointsBalance / next.costPoints) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {card.rewards.map((reward) => {
          const ready = card.pointsBalance >= reward.costPoints
          return (
            <li
              key={reward.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${ready ? 'bg-green-50' : 'bg-slate-50'}`}
            >
              <div>
                <p className="font-medium">{reward.name}</p>
                {reward.description && (
                  <p className="text-sm text-slate-500">{reward.description}</p>
                )}
              </div>
              <span
                className={
                  ready ? 'text-sm font-semibold text-green-700' : 'text-sm text-slate-500'
                }
              >
                {ready ? '¡Ya podés canjearla!' : `${reward.costPoints} ${unit}`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
