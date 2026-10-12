import { lazy, Suspense, useState } from 'react'
import { buyLink } from '../lib/plans'
import { STAMP_GOAL } from '../lib/stamps'

const StampCard3D = lazy(() => import('./StampCard3D'))

export function Hero() {
  const [stamps, setStamps] = useState(3)
  const [prizes, setPrizes] = useState(0)

  function addStamp() {
    if (stamps >= STAMP_GOAL) return
    const next = stamps + 1
    setStamps(next)
    if (next === STAMP_GOAL) {
      setPrizes((p) => p + 1)
      window.setTimeout(() => setStamps(0), 1600)
    }
  }

  const full = stamps >= STAMP_GOAL

  return (
    <section className="relative overflow-hidden px-5 pt-28 pb-16 md:px-10 md:pt-36">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[38rem] w-[38rem] rounded-full bg-durazno/25 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.05fr_1fr]">
        <div className="reveal is-visible">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-mostaza px-3 py-1 text-sm font-semibold">
            Para cafés, barberías, panaderías y locales de barrio
          </p>
          <h1 className="font-display text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.92] font-extrabold tracking-[-0.03em]">
            Que tus clientes{' '}
            <span className="font-serif font-normal italic text-terracota">vuelvan</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-piedra md:text-xl">
            Neriva te avisa quién dejó de venir, le arma el WhatsApp y te muestra cuánta plata
            volvió. Tu cliente lleva su tarjeta de sellos en el celular, sin bajar ninguna app.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#planes"
              className="rounded-full bg-noche px-7 py-4 text-base font-semibold text-crema transition hover:-translate-y-0.5 hover:bg-terracota"
            >
              Ver planes
            </a>
            <a
              href={buyLink(null)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-7 py-4 text-base font-semibold ring-2 ring-noche transition hover:bg-noche hover:text-crema"
            >
              Escribinos por WhatsApp
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[5/4] w-full">
            <Suspense
              fallback={<div className="h-full w-full animate-pulse rounded-3xl bg-papel" />}
            >
              <StampCard3D stamps={stamps} onStamp={addStamp} />
            </Suspense>
          </div>
          <div className="mx-auto -mt-4 flex w-fit items-center gap-3 rounded-full bg-white/80 px-5 py-2.5 text-sm shadow-[0_8px_30px_-12px_rgba(28,25,23,0.35)] backdrop-blur">
            <span className="font-semibold">
              {full ? '¡Café de regalo! ☕' : `${stamps} de ${STAMP_GOAL} sellos`}
            </span>
            <span className="text-piedra">
              {full ? 'Así de fácil vuelve.' : 'Tocá la tarjeta para sellar'}
            </span>
            {prizes > 0 && (
              <span className="rounded-full bg-yerba px-2 py-0.5 text-xs font-semibold text-white">
                {prizes} {prizes === 1 ? 'premio' : 'premios'}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
