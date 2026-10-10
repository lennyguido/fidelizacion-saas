import { textColorOn, type StampSlots } from '@plataforma/sdk'

/** Tilde de respaldo cuando el negocio no subió un logo. */
function CheckIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3/5 w-3/5" fill="none" aria-hidden>
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Stamp({
  filled,
  latest,
  brand,
  logo,
}: {
  filled: boolean
  latest: boolean
  brand: string
  logo: string | null
}) {
  if (!filled) {
    return (
      <span
        className="aspect-square w-full rounded-full border-2 border-dashed"
        style={{ borderColor: `${brand}55`, backgroundColor: `${brand}0d` }}
        data-testid="stamp-empty"
      />
    )
  }
  return (
    <span
      className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-full p-1 shadow-sm ${latest ? 'stamp-latest' : ''}`}
      style={{ backgroundColor: brand }}
      data-testid="stamp-filled"
    >
      {logo ? (
        <img
          src={logo}
          alt=""
          className="h-full w-full rounded-full bg-white object-contain p-0.5"
        />
      ) : (
        <CheckIcon color={textColorOn(brand)} />
      )}
    </span>
  )
}

/**
 * Tarjeta de sellos: un casillero por sello (en filas de 5) que se llena con el logo
 * del negocio. Los números los arma el SDK (card.stampSlots); acá solo se dibujan.
 */
export function StampCard({
  slots,
  unit,
  brand,
  logo,
}: {
  slots: StampSlots
  unit: string
  brand: string
  logo: string | null
}) {
  const singular = unit === 'sellos' ? 'sello' : 'punto'
  const missingText =
    slots.missing === 1 ? `Te falta 1 ${singular} para` : `Te faltan ${slots.missing} ${unit} para`

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm" data-testid="stamp-card">
      <h2 className="mb-3 font-semibold">Tu tarjeta de sellos</h2>
      <div
        role="img"
        aria-label={`${slots.progress} de ${slots.goal} ${unit}`}
        data-testid="stamp-grid"
        className="mx-auto grid max-w-xs grid-cols-5 gap-2.5"
      >
        {Array.from({ length: slots.total }, (_, index) => (
          <Stamp
            key={index}
            filled={index < slots.filled}
            latest={index === slots.filled - 1}
            brand={brand}
            logo={logo}
          />
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-slate-600">
        {slots.missing > 0 ? (
          <>
            {missingText} <strong>{slots.reward.name}</strong>
          </>
        ) : (
          <>
            ¡Completaste la tarjeta! Pedí <strong>{slots.reward.name}</strong> en la caja.
          </>
        )}
      </p>
      <p className="mt-1 text-center text-sm font-medium" data-testid="rewards-ready">
        Recompensas listas: {slots.readyCount}
      </p>
    </section>
  )
}
