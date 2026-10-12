import { useRef, useState, type PointerEvent } from 'react'
import { buyLink, formatPesos, PLANS, type Plan } from '../lib/plans'

/** Planes con tarjetas que se inclinan en 3D siguiendo el mouse. */
export function Plans() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="planes" className="bg-papel px-5 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="reveal font-serif text-2xl text-terracota italic">Planes</p>
            <h2 className="reveal mt-2 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
              Menos de lo que te devuelve. Y lo vas a ver.
            </h2>
          </div>
          <div className="reveal flex rounded-full bg-white p-1 ring-1 ring-noche/10" role="group">
            <Toggle active={!yearly} onClick={() => setYearly(false)}>
              Mensual
            </Toggle>
            <Toggle active={yearly} onClick={() => setYearly(true)}>
              Anual · 2 meses gratis
            </Toggle>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3" style={{ perspective: '1200px' }}>
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} yearly={yearly} />
          ))}
        </div>

        <p className="reveal mt-10 text-center text-piedra">
          Sin registro abierto: después del pago te damos el acceso a tu mail y en 20 minutos
          dejamos tu local andando. Si en un mes no volvió ni un cliente, ese mes no lo pagás.
        </p>
      </div>
    </section>
  )
}

function Toggle(props: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        props.active ? 'bg-noche text-crema' : 'text-piedra hover:text-noche'
      }`}
    >
      {props.children}
    </button>
  )
}

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect()
    if (!box || event.pointerType !== 'mouse') return
    const x = (event.clientX - box.left) / box.width - 0.5
    const y = (event.clientY - box.top) / box.height - 0.5
    setTilt({ x: -y * 10, y: x * 12 })
  }

  const dark = plan.highlight
  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      className={`reveal relative flex flex-col rounded-[1.75rem] p-8 transition-transform duration-200 ease-out will-change-transform ${
        dark
          ? 'bg-noche text-crema shadow-[0_40px_80px_-30px_rgba(28,25,23,0.7)]'
          : 'bg-white ring-1 ring-noche/10'
      }`}
      style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
    >
      {dark && (
        <span className="absolute -top-3 right-6 rotate-3 rounded-full bg-mostaza px-3 py-1 text-xs font-bold text-noche">
          El más elegido
        </span>
      )}
      <h3 className="font-display text-3xl font-bold">{plan.name}</h3>
      <p className={`mt-1 ${dark ? 'text-crema/70' : 'text-piedra'}`}>{plan.tagline}</p>
      <p className="mt-6 font-display text-5xl font-extrabold tracking-tight tabular-nums">
        {formatPesos(yearly ? plan.yearly : plan.price)}
        <span className={`text-base font-medium ${dark ? 'text-crema/60' : 'text-piedra'}`}>
          {yearly ? ' /año' : ' /mes'}
        </span>
      </p>
      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-[15px]">
            <span className={dark ? 'text-durazno' : 'text-terracota'}>●</span>
            {feature}
          </li>
        ))}
      </ul>
      <a
        href={buyLink(plan)}
        target="_blank"
        rel="noreferrer"
        className={`mt-8 rounded-full px-6 py-4 text-center font-semibold transition hover:-translate-y-0.5 ${
          dark ? 'bg-durazno text-noche hover:bg-crema' : 'bg-noche text-crema hover:bg-terracota'
        }`}
      >
        Comprar {plan.name}
      </a>
    </div>
  )
}
