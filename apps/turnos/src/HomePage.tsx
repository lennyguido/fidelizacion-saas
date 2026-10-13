const SALES_WHATSAPP = '5491128330853'
const salesLink = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(
  '¡Hola! Quiero Turnos de Neriva para mi negocio: ',
)}`

const POINTS = [
  {
    title: 'Tus clientes sacan turno solos',
    text: 'Un link para tu Instagram y tu WhatsApp. Eligen servicio, profesional, día y hora en segundos, a cualquier hora.',
  },
  {
    title: 'Sin comisiones por turno',
    text: 'Pagás un precio fijo por mes. No te cobramos por cada reserva, ni cuando alguien no viene.',
  },
  {
    title: 'Nunca dos turnos a la misma hora',
    text: 'La agenda no deja superponer turnos del mismo profesional, aunque reserven dos personas a la vez.',
  },
  {
    title: 'Cancelan con un toque',
    text: 'Cada cliente recibe su link para ver o cancelar el turno, así el horario queda libre para otro.',
  },
  {
    title: 'Los que dejaron de venir vuelven',
    text: 'Cada turno queda en la ficha del cliente. Con Neriva le escribís al que hace mucho no viene.',
  },
]

/** Página de producto (para dueños de barberías, peluquerías y profesionales). */
export function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium text-slate-500">Neriva Turnos</p>
        <h1 className="text-4xl font-bold tracking-tight">
          Que tu agenda se llene sola, sin comisiones por turno.
        </h1>
        <p className="text-lg text-slate-600">
          Turnos online para barberías, peluquerías, manicuras y profesionales.
        </p>
        <a
          href={salesLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 w-fit items-center rounded-full bg-action px-6 font-medium text-white hover:bg-action-hover"
        >
          Quiero Turnos para mi negocio
        </a>
      </header>
      <ul className="flex flex-col gap-4">
        {POINTS.map((point) => (
          <li key={point.title} className="rounded-2xl bg-white p-5">
            <h2 className="font-semibold">{point.title}</h2>
            <p className="mt-1 text-slate-600">{point.text}</p>
          </li>
        ))}
      </ul>
      <footer className="text-sm text-slate-500">
        Neriva · <a href="https://neriva.net">neriva.net</a>
      </footer>
    </main>
  )
}
