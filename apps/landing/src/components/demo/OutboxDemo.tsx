import { useState } from 'react'

const MESSAGES = [
  { name: 'Martín R.', why: 'En riesgo · no viene hace 24 días' },
  { name: 'Sofía L.', why: 'Cumple hoy 🎂' },
  { name: 'Julián T.', why: 'Segunda visita · vino hace 10 días' },
]

/** Mensajes listos: el sistema los arma a la mañana, vos los mandás con un toque. */
export function OutboxDemo() {
  const [sent, setSent] = useState<string[]>([])
  const pending = MESSAGES.length - sent.length

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">
        {pending > 0 ? `Hoy hay ${pending} mensajes listos` : 'Todo mandado por hoy ✓'}
      </p>
      {MESSAGES.map((message) => {
        const done = sent.includes(message.name)
        return (
          <div
            key={message.name}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 transition ${
              done ? 'bg-yerba/10 ring-yerba/30' : 'bg-white ring-noche/10'
            }`}
          >
            <div>
              <p className="font-semibold">{message.name}</p>
              <p className="text-xs text-piedra">{message.why}</p>
            </div>
            <button
              type="button"
              disabled={done}
              onClick={() => setSent((s) => [...s, message.name])}
              className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-noche transition active:scale-95 disabled:bg-transparent disabled:text-yerba"
            >
              {done ? 'Enviado ✓' : 'WhatsApp'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
