import { useState } from 'react'
import { formatPesos } from '../lib/plans'

/**
 * "¿Cuánta plata se te va?": cuenta simple y honesta, marcada como estimación.
 * Se pierde: clientes que dejan de venir × visitas por mes × ticket.
 * Vuelve (estimado conservador): 1 de cada 5 a los que se les escribe.
 */
export function Calculator() {
  const [customers, setCustomers] = useState(300)
  const [ticket, setTicket] = useState(6500)
  const [lostPct, setLostPct] = useState(15)

  const lostCustomers = Math.round((customers * lostPct) / 100)
  const lostMoney = lostCustomers * ticket * 3
  const recovered = Math.round(lostCustomers * 0.2) * ticket * 3

  return (
    <section className="px-5 py-24 md:px-10">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        <div>
          <p className="reveal font-serif text-2xl text-terracota italic">Hacé la cuenta</p>
          <h2 className="reveal mt-2 font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
            ¿Cuánta plata se te va por la puerta?
          </h2>
          <div className="reveal mt-10 flex flex-col gap-7">
            <Slider
              label="Clientes distintos por mes"
              value={customers}
              display={String(customers)}
              min={50}
              max={2000}
              step={10}
              onChange={setCustomers}
            />
            <Slider
              label="Ticket promedio"
              value={ticket}
              display={formatPesos(ticket)}
              min={1000}
              max={40000}
              step={500}
              onChange={setTicket}
            />
            <Slider
              label="Clientes que dejan de venir por mes"
              value={lostPct}
              display={`${lostPct}%`}
              min={5}
              max={40}
              step={1}
              onChange={setLostPct}
            />
          </div>
        </div>
        <div className="reveal flex flex-col justify-center gap-4">
          <div className="rounded-[1.75rem] bg-noche p-8 text-crema">
            <p className="text-sm text-crema/60">Se te van por mes</p>
            <p className="font-display text-5xl font-extrabold tabular-nums">
              {lostCustomers} clientes
            </p>
            <p className="mt-1 text-crema/70">
              ≈ {formatPesos(lostMoney)} que dejan de entrar (si venían 3 veces por mes)
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-yerba p-8 text-white">
            <p className="text-sm text-white/75">Si recuperás 1 de cada 5</p>
            <p className="font-display text-5xl font-extrabold tabular-nums">
              +{formatPesos(recovered)}
            </p>
            <p className="mt-1 text-white/80">
              por mes. El plan Barrio cuesta {formatPesos(24900)}.
            </p>
          </div>
          <p className="text-xs text-piedra">
            Es una estimación para hacerte una idea, no una promesa. En tu local lo medimos de
            verdad, contra un grupo de control.
          </p>
        </div>
      </div>
    </section>
  )
}

function Slider(props: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-3">
      <span className="flex items-baseline justify-between">
        <span className="font-medium">{props.label}</span>
        <span className="font-display text-2xl font-bold tabular-nums">{props.display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-terracota"
      />
    </label>
  )
}
