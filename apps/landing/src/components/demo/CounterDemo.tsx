import { useState } from 'react'

const PEOPLE = [
  { name: 'Ana Gómez', detail: 'viene cada ~9 días · visita 23' },
  { name: 'Don Carlos', detail: 'cortado sin azúcar · visita 51' },
  { name: 'Lucía P.', detail: 'primera semana · visita 2' },
]

/** Mostrador: buscar y +1. Así de rápido se carga una visita. */
export function CounterDemo() {
  const [visits, setVisits] = useState<Record<string, number>>({})
  const [last, setLast] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-white px-4 py-3 text-sm text-piedra ring-1 ring-noche/10">
        Buscar cliente, celular o código de socio…
      </div>
      {PEOPLE.map((person) => (
        <div
          key={person.name}
          className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-noche/10"
        >
          <div>
            <p className="font-semibold">{person.name}</p>
            <p className="text-xs text-piedra">{person.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setVisits((v) => ({ ...v, [person.name]: (v[person.name] ?? 0) + 1 }))
              setLast(person.name)
            }}
            className="h-11 min-w-14 rounded-full bg-noche px-4 font-bold text-crema transition active:scale-95 hover:bg-terracota"
          >
            +1{visits[person.name] ? ` (${visits[person.name]})` : ''}
          </button>
        </div>
      ))}
      <p className="h-5 text-sm font-medium text-yerba" aria-live="polite">
        {last ? `Visita de ${last} registrada · +1 sello` : ''}
      </p>
    </div>
  )
}
