import { useState } from 'react'

const SALES_WHATSAPP = '5491128330853'
const PRICE = 24900
const COMMISSION = 0.2

function wa(text: string): string {
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`
}
const TRY_LINK = wa('¡Hola! Quiero probar Neriva Turnos 30 días gratis. Mi negocio es: ')

function pesos(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

/** Página de venta de Turnos (turnos.neriva.net, D-050). */
export function HomePage() {
  return (
    <div className="sales min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="display text-xl font-bold">Neriva Turnos</span>
        <a href="/panel" className="text-sm font-semibold underline-offset-4 hover:underline">
          Entrar a mi agenda
        </a>
      </header>

      <main>
        <Hero />
        <Calculator />
        <Features />
        <Compare />
        <Pricing />
        <Faq />
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-sm opacity-70">
        Neriva Turnos es parte de <a href="https://neriva.net" className="underline">Neriva</a>,
        hecho en Argentina.
      </footer>
    </div>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-8 pb-20 md:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-6">
        <h1 className="display text-[clamp(3rem,9vw,6.5rem)] font-extrabold">
          Tu agenda llena. Cero comisiones.
        </h1>
        <p className="max-w-[46ch] text-lg leading-relaxed opacity-80">
          Turnos online para barberías, peluquerías, manicuras y estética. Tus clientes reservan
          solos desde Instagram o WhatsApp, a cualquier hora, y vos pagás un precio fijo por mes.
          Nunca un porcentaje de lo que cobrás.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={TRY_LINK}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-13 items-center rounded-full bg-[var(--lacquer)] px-7 text-base font-semibold text-white hover:opacity-90"
          >
            Probar 30 días gratis
          </a>
          <a
            href="#calculadora"
            className="inline-flex h-13 items-center rounded-full px-7 text-base font-semibold ring-2 ring-inset ring-[var(--ink)]"
          >
            Calcular cuánto ahorro
          </a>
        </div>
        <p className="text-sm opacity-60">Sin tarjeta. Te lo dejamos andando nosotros, por WhatsApp.</p>
      </div>
      <PhoneDemo />
    </section>
  )
}

/** Lo que ve el cliente al reservar (réplica estática de la pantalla real). */
function PhoneDemo() {
  const slots = ['10:00', '10:30', '11:00', '12:30', '15:00', '15:30', '16:00', '17:30']
  const [picked, setPicked] = useState('15:30')
  return (
    <div
      aria-label="Así reserva tu cliente"
      className="mx-auto w-full max-w-[320px] rounded-[2.5rem] bg-[var(--ink)] p-3 shadow-[0_30px_60px_-20px_rgba(30,27,46,0.45)]"
    >
      <div className="flex flex-col gap-4 rounded-[2rem] bg-white p-5 text-[var(--ink)]">
        <div>
          <p className="display text-2xl font-bold">Barbería Sol</p>
          <p className="text-sm opacity-60">Sacá tu turno</p>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-[var(--lilac)] px-4 py-3">
          <span className="font-semibold">Corte y barba</span>
          <span className="text-sm opacity-70">45 min · $12.000</span>
        </div>
        <p className="text-sm font-semibold">Jueves 16 de octubre</p>
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPicked(s)}
              aria-pressed={s === picked}
              className={`rounded-full py-2 text-sm font-semibold ${
                s === picked ? 'bg-[var(--lacquer)] text-white' : 'bg-[var(--paper)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="rounded-2xl bg-[var(--ink)] py-3 text-center font-semibold text-white">
          Confirmar a las {picked}
        </div>
      </div>
    </div>
  )
}

function Calculator() {
  const [clients, setClients] = useState(40)
  const [ticket, setTicket] = useState(12000)
  const lost = clients * ticket * COMMISSION
  const year = lost * 12

  return (
    <section id="calculadora" className="bg-[var(--ink)] py-20 text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-2">
        <div className="flex flex-col gap-8">
          <h2 className="display text-[clamp(2.2rem,5vw,3.75rem)] font-bold">
            ¿Cuánto te cuestan las apps que cobran comisión?
          </h2>
          <p className="max-w-[48ch] opacity-75">
            Algunas apps de turnos cobran hasta un 20 % por cada cliente nuevo que reserva, aunque
            después vuelva siempre. Mové los números con los de tu local.
          </p>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Clientes nuevos por mes: {clients}</span>
            <input
              type="range"
              min={5}
              max={150}
              step={5}
              value={clients}
              onChange={(e) => setClients(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Lo que cobra un turno en promedio: {pesos(ticket)}</span>
            <input
              type="range"
              min={3000}
              max={60000}
              step={1000}
              value={ticket}
              onChange={(e) => setTicket(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="flex flex-col justify-center gap-6">
          <div>
            <p className="opacity-70">Con una app de 20 % de comisión se te van</p>
            <p className="count display text-[clamp(3rem,8vw,5.5rem)] font-extrabold text-[#ff7aa8]">
              {pesos(lost)} <span className="text-2xl font-semibold">por mes</span>
            </p>
            <p className="opacity-70">{pesos(year)} en un año.</p>
          </div>
          <div className="rounded-3xl bg-white/8 p-6 ring-1 ring-white/15">
            <p className="opacity-70">Con Neriva Turnos pagás</p>
            <p className="display text-5xl font-extrabold text-[#7fe0b0]">
              {pesos(PRICE)} <span className="text-xl font-semibold">fijos por mes</span>
            </p>
            <p className="mt-2 opacity-70">
              Tengas 5 o 500 reservas. Lo que cobrás es todo tuyo.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    title: 'Reservas solas, las 24 horas',
    text: 'Un link para tu bio de Instagram y tu WhatsApp. Eligen servicio, profesional, día y hora en menos de un minuto, sin bajar ninguna app.',
  },
  {
    title: 'Agenda de la semana por profesional',
    text: 'Ves quién atiende a quién y a qué hora. Movés un turno, marcás quién vino y quién faltó, y cargás los que te piden por teléfono.',
  },
  {
    title: 'Nunca dos turnos encima',
    text: 'Aunque dos personas reserven al mismo tiempo el mismo horario, solo entra una. La otra ve los horarios que siguen libres.',
  },
  {
    title: 'Cambian o cancelan con un toque',
    text: 'Cada cliente tiene su link para cambiar el horario o cancelar. El lugar queda libre para otro, sin que tengas que contestar mensajes.',
  },
  {
    title: 'La ficha de cada cliente',
    text: 'Cuántas veces vino, cuánto gastó y cuántas veces faltó. Sabés a quién cuidar y a quién pedirle que avise.',
  },
  {
    title: 'Los que dejaron de venir, vuelven',
    text: 'Si además usás Neriva, cada turno suma a su tarjeta de puntos y te avisamos cuando alguien hace mucho que no viene.',
  },
]

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="display max-w-[18ch] text-[clamp(2.2rem,5vw,3.75rem)] font-bold">
        Todo lo que necesita un local que vive de turnos.
      </h2>
      <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="border-t-2 border-[var(--ink)] pt-4">
            <dt className="text-xl font-semibold">{f.title}</dt>
            <dd className="mt-2 max-w-[52ch] leading-relaxed opacity-75">{f.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const ROWS: [string, string, string][] = [
  ['Comisión por cliente nuevo', 'Hasta 20 %', 'Nunca'],
  ['Precio', 'Suscripción más extras por uso', 'Fijo, en pesos'],
  ['Soporte', 'Por mail o chat', 'Por WhatsApp, en castellano'],
  ['Tus clientes', 'Comparten vidriera con la competencia', 'Son tuyos, con tu link'],
]

function Compare() {
  return (
    <section className="bg-[var(--lilac)] py-20">
      <div className="mx-auto max-w-4xl px-5">
        <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] font-bold">
          La diferencia con las apps de afuera
        </h2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="text-sm">
                <th className="py-3 pr-4 font-medium opacity-60" scope="col">
                  <span className="sr-only">Tema</span>
                </th>
                <th className="py-3 pr-4 font-medium opacity-60" scope="col">
                  Apps con comisión
                </th>
                <th className="py-3 font-semibold text-[var(--lacquer)]" scope="col">
                  Neriva Turnos
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([topic, them, us]) => (
                <tr key={topic} className="border-t border-[var(--ink)]/15">
                  <th scope="row" className="py-4 pr-4 font-semibold">
                    {topic}
                  </th>
                  <td className="py-4 pr-4 opacity-70">{them}</td>
                  <td className="py-4 font-semibold">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
      <div>
        <h2 className="display text-[clamp(2.2rem,5vw,3.75rem)] font-bold">Un solo precio.</h2>
        <p className="mt-4 max-w-[44ch] text-lg leading-relaxed opacity-80">
          Reservas y profesionales sin límite, agenda semanal y la ficha de tus clientes. 30
          días gratis para probarlo con tu agenda real.
        </p>
      </div>
      <div className="rounded-[2rem] bg-white p-8 ring-2 ring-[var(--ink)]">
        <p className="display text-6xl font-extrabold">{pesos(PRICE)}</p>
        <p className="mt-1 opacity-70">por mes, todo incluido</p>
        <a
          href={TRY_LINK}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex h-13 w-full items-center justify-center rounded-full bg-[var(--lacquer)] text-base font-semibold text-white hover:opacity-90"
        >
          Probar 30 días gratis
        </a>
        <p className="mt-3 text-center text-sm opacity-60">Si no te sirve, no pagás nada.</p>
      </div>
    </section>
  )
}

const FAQ = [
  [
    '¿Mis clientes tienen que bajar una app?',
    'No. Reservan desde el navegador del celular con tu link, en menos de un minuto.',
  ],
  [
    '¿Qué pasa si ya uso otra app?',
    'Te ayudamos a pasar tus servicios y horarios. Podés usar las dos unas semanas hasta que estés tranquilo.',
  ],
  [
    '¿Puedo cargar turnos que me piden por teléfono?',
    'Sí, desde tu agenda, en dos toques. Quedan en el mismo calendario que los online.',
  ],
  [
    '¿Necesito una computadora?',
    'No. La agenda funciona en el celular. En una compu se ve la semana entera más cómoda.',
  ],
] as const

function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-20">
      <h2 className="display text-[clamp(2rem,4.5vw,3rem)] font-bold">Preguntas de otros dueños</h2>
      <div className="mt-8 flex flex-col">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group border-t border-[var(--ink)]/20 py-5">
            <summary className="cursor-pointer list-none text-lg font-semibold">{q}</summary>
            <p className="mt-2 leading-relaxed opacity-75">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
