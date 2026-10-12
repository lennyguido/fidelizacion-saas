import { useState } from 'react'

/** Lo que ve el cliente en el celular: su tarjeta de sellos. */
export function CardDemo() {
  const [stamps, setStamps] = useState(5)
  const goal = 9

  return (
    <div className="mx-auto w-full max-w-[17rem] rounded-[2.2rem] bg-noche p-3 shadow-2xl">
      <div className="rounded-[1.7rem] bg-crema p-5">
        <p className="text-xs text-piedra">Café del Barrio</p>
        <p className="font-display text-2xl font-bold">Hola, Ana</p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {Array.from({ length: goal }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Sello ${i + 1}`}
              onClick={() => setStamps(i + 1)}
              className={`grid aspect-square place-items-center rounded-full border-2 text-sm font-bold transition ${
                i < stamps
                  ? 'stamp-in border-terracota bg-terracota text-crema'
                  : i === goal - 1
                    ? 'border-dashed border-terracota text-terracota'
                    : 'border-noche/20 text-noche/30'
              }`}
            >
              {i === goal - 1 ? '☕' : i < stamps ? '✓' : i + 1}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm font-medium">
          {stamps >= goal ? '¡Tenés un café de regalo!' : `Te faltan ${goal - stamps} para tu café`}
        </p>
        <div className="mt-3 rounded-xl bg-white p-3 text-center font-mono text-sm tracking-[0.3em] ring-1 ring-noche/10">
          ANA7K2QX
        </div>
        <p className="mt-2 text-center text-[11px] text-piedra">Mostrá este código en la caja</p>
      </div>
    </div>
  )
}
