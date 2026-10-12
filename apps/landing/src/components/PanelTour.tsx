import { useState, type ComponentType } from 'react'
import { AutomationDemo } from './demo/AutomationDemo'
import { CardDemo } from './demo/CardDemo'
import { CounterDemo } from './demo/CounterDemo'
import { OutboxDemo } from './demo/OutboxDemo'
import { StatsDemo } from './demo/StatsDemo'

interface Step {
  id: string
  label: string
  title: string
  text: string
  Demo: ComponentType
}

const STEPS: Step[] = [
  {
    id: 'mostrador',
    label: 'Mostrador',
    title: 'Una visita en dos segundos',
    text: 'El cajero busca al cliente (o escanea su QR) y toca +1. Sin papelitos ni sellos de goma.',
    Demo: CounterDemo,
  },
  {
    id: 'tarjeta',
    label: 'Tarjeta',
    title: 'La tarjeta vive en el celular',
    text: 'El cliente ve sus sellos y su premio. No baja ninguna app: es un link, y se puede guardar en la billetera del teléfono.',
    Demo: CardDemo,
  },
  {
    id: 'automatico',
    label: 'Automático',
    title: 'Recupera clientes mientras atendés',
    text: 'Prendés una vez y todas las mañanas Neriva detecta quién dejó de venir, quién cumple años y quién vino una sola vez.',
    Demo: AutomationDemo,
  },
  {
    id: 'mensajes',
    label: 'Mensajes listos',
    title: 'Vos solo tocás "WhatsApp"',
    text: 'El mensaje ya está escrito, con el nombre y un cupón único. Solo a quien aceptó recibir mensajes.',
    Demo: OutboxDemo,
  },
  {
    id: 'estadisticas',
    label: 'Estadísticas',
    title: 'Cuánta plata volvió, de verdad',
    text: 'Visitas, ticket promedio, clientes recuperados y la plata que trajo cada mensaje, medida contra un grupo de control.',
    Demo: StatsDemo,
  },
]

/** Recorrido interactivo por el panel: cada pestaña se puede tocar. */
export function PanelTour() {
  const [active, setActive] = useState(0)
  const step = STEPS[active] ?? STEPS[0]!
  const Demo = step.Demo

  return (
    <section id="panel" className="bg-noche px-5 py-24 text-crema md:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="reveal font-serif text-2xl text-durazno italic">Probalo acá mismo</p>
        <h2 className="reveal mt-2 max-w-3xl font-display text-[clamp(2.2rem,5vw,4rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
          Todo el local en una pantalla que entiende cualquiera.
        </h2>

        <div className="reveal mt-10 flex gap-2 overflow-x-auto pb-2" role="tablist">
          {STEPS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                i === active ? 'bg-crema text-noche' : 'bg-white/10 text-crema hover:bg-white/20'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="reveal mt-8 grid items-center gap-10 md:grid-cols-[0.9fr_1.1fr]">
          <div key={step.id} className="md:pr-6">
            <h3 className="font-display text-3xl font-bold">{step.title}</h3>
            <p className="mt-4 text-lg leading-relaxed text-crema/75">{step.text}</p>
          </div>
          <div
            key={`${step.id}-demo`}
            className="rounded-[1.75rem] bg-crema p-5 text-noche shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] md:p-7"
            role="tabpanel"
          >
            <Demo />
          </div>
        </div>
      </div>
    </section>
  )
}
