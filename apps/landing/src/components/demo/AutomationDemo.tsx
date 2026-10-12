import { useState } from 'react'

const AUTOMATIONS = [
  { id: 'risk', title: 'Clientes en riesgo', text: 'Tarda el doble de lo habitual en volver.' },
  { id: 'second', title: 'Segunda visita', text: 'Vino una sola vez, hace 10 días.' },
  { id: 'birthday', title: 'Cumpleaños', text: 'El día de su cumple, con un regalo.' },
]

/** Recuperación automática: se prende una vez y trabaja todas las mañanas. */
export function AutomationDemo() {
  const [on, setOn] = useState<Record<string, boolean>>({ risk: true })

  return (
    <div className="flex flex-col gap-3">
      {AUTOMATIONS.map((item) => {
        const enabled = Boolean(on[item.id])
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setOn((s) => ({ ...s, [item.id]: !s[item.id] }))}
            className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 text-left ring-1 ring-noche/10"
            aria-pressed={enabled}
          >
            <span>
              <span className="block font-semibold">{item.title}</span>
              <span className="block text-xs text-piedra">{item.text}</span>
            </span>
            <span
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-yerba' : 'bg-noche/20'}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`}
              />
            </span>
          </button>
        )
      })}
      <div className="rounded-xl bg-papel p-4 text-sm">
        <p className="text-xs font-semibold tracking-wide text-terracota uppercase">
          Así le llega a Ana
        </p>
        <p className="mt-1">
          ¡Hola Ana! Hace un tiempo que no te vemos por Café del Barrio. Te esperamos con un 10% de
          descuento: mostrá el código <b>K7P2QX</b>.
        </p>
      </div>
    </div>
  )
}
