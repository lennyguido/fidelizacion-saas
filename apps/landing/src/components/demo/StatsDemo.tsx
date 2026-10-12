import { useState } from 'react'

const WEEKS = [62, 71, 58, 80, 77, 91, 88, 104]

/** Estadísticas: visitas por semana y la plata que volvió (con grupo de control). */
export function StatsDemo() {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...WEEKS)
  const shown = hover ?? WEEKS.length - 1

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Visitas (sem.)" value={String(WEEKS[shown] ?? 0)} />
        <Tile label="Volvieron" value="18" />
        <Tile label="Plata que volvió" value="$186.400" money />
      </div>
      <div className="flex h-40 items-end gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10">
        {WEEKS.map((value, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Semana ${i + 1}: ${value} visitas`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="group flex h-full flex-1 items-end"
          >
            <span
              className={`w-full rounded-t-md transition-all duration-500 ${
                i === shown ? 'bg-terracota' : 'bg-noche/15 group-hover:bg-noche/30'
              }`}
              style={{ height: `${(value / max) * 100}%` }}
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-piedra">
        Comparamos contra un grupo al que no se le escribió: lo que ves es lo que volvió gracias a
        Neriva, no una promesa.
      </p>
    </div>
  )
}

function Tile({ label, value, money }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-noche/10">
      <p className="text-[11px] text-piedra">{label}</p>
      <p className={`font-display text-xl font-bold ${money ? 'text-yerba' : ''}`}>{value}</p>
    </div>
  )
}
