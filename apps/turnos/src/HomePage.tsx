import { useState } from 'react'

const SALES_WHATSAPP = '5491128330853'
const PRICE = 29900
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
        <FillGaps />
        <Features />
        <Compare />
        <Pricing />
        <Faq />
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-sm opacity-70">
        Neriva Turnos es parte de{' '}
        <a href="https://neriva.net" className="underline">
          Neriva
        </a>
        , hecho en Argentina.
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
        <p className="text-sm opacity-60">
          Sin tarjeta. Te lo dejamos andando nosotros, por WhatsApp.
        </p>
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
            <span className="font-semibold">
              Lo que cobra un turno en promedio: {pesos(ticket)}
            </span>
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
            <p className="mt-2 opacity-70">Tengas 5 o 500 reservas. Lo que cobrás es todo tuyo.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

type DemoRow = { time: string; who: string | null; away?: number }

const DEMO_DAY: DemoRow[] = [
  { time: '10:00', who: 'Martín' },
  { time: '11:00', who: null, away: 42 },
  { time: '12:00', who: 'Lucas' },
  { time: '15:00', who: null, away: 35 },
  { time: '16:00', who: 'Nico' },
  { time: '17:00', who: null, away: 58 },
]
const DEMO_NAMES: Record<string, string> = { '11:00': 'Juan', '15:00': 'Tomás', '17:00': 'Fede' }

/** Llenar huecos (D-053): la agenda del jueves con huecos que se llenan con un mensaje. */
function FillGaps() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col gap-6">
        <h2 className="display text-[clamp(2.2rem,5vw,3.75rem)] font-bold">
          Un hueco en la agenda es plata que no entra.
        </h2>
        <p className="max-w-[46ch] text-lg leading-relaxed opacity-80">
          Neriva Turnos te muestra los horarios libres del día y los clientes que hace rato no
          vuelven. Les mandás una oferta por WhatsApp con un toque y el lugar se llena.
        </p>
        <ol className="flex flex-col gap-4">
          {[
            ['Ves los huecos', 'Hoy, mañana o cualquier día de la semana.'],
            [
              'Elegís a quién invitar',
              'Solo aparecen los que aceptaron recibir promociones, así nadie lo siente como spam.',
            ],
            [
              'Mandás la oferta',
              'Se abre tu WhatsApp con el mensaje listo: nombre, horario, descuento y tu link.',
            ],
          ].map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[2.25rem_1fr] gap-3">
              <span className="display flex h-9 w-9 items-center justify-center rounded-full bg-[var(--lacquer)] font-bold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block opacity-75">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <GapsDemo />
    </section>
  )
}

function GapsDemo() {
  const [open, setOpen] = useState<string | null>('11:00')
  const [filled, setFilled] = useState<string[]>([])
  const row = DEMO_DAY.find((r) => r.time === open)
  const name = open ? DEMO_NAMES[open] : undefined
  const left = DEMO_DAY.filter((r) => !r.who && !filled.includes(r.time)).length

  return (
    <div className="flex flex-col gap-4 rounded-[2rem] bg-[var(--lilac)] p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="display text-2xl font-bold">Jueves</p>
        <p className="text-sm font-semibold" aria-live="polite">
          {left === 0 ? '¡Agenda llena!' : `${left} ${left === 1 ? 'hueco' : 'huecos'}`}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {DEMO_DAY.map((r) => {
          const isFilled = filled.includes(r.time)
          const isHole = !r.who && !isFilled
          return (
            <li key={r.time} className="grid grid-cols-[3.25rem_1fr] items-center gap-3">
              <span className="text-sm font-semibold tabular-nums opacity-70">{r.time}</span>
              {isHole ? (
                <button
                  type="button"
                  onClick={() => setOpen(r.time)}
                  aria-pressed={open === r.time}
                  className={`h-11 rounded-xl border-2 border-dashed px-4 text-left text-sm font-semibold ${
                    open === r.time
                      ? 'border-[var(--lacquer)] bg-white text-[var(--lacquer)]'
                      : 'border-[var(--ink)]/30 hover:border-[var(--lacquer)]'
                  }`}
                >
                  Libre · ofrecer a {DEMO_NAMES[r.time]}
                </button>
              ) : (
                <span
                  className={`flex h-11 items-center rounded-xl px-4 text-sm font-semibold ${
                    isFilled ? 'bg-[var(--lacquer)] text-white' : 'bg-[var(--ink)] text-white'
                  }`}
                >
                  {isFilled ? `${DEMO_NAMES[r.time]} · volvió con la oferta` : r.who}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {row && name && !filled.includes(row.time) ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4">
          <p className="text-xs font-semibold opacity-60">
            {name} no viene hace {row.away} días
          </p>
          <p className="max-w-[34ch] self-end rounded-2xl rounded-br-sm bg-[#d9fdd3] px-4 py-3 text-sm leading-relaxed">
            ¡Hola {name}! Hace rato no te vemos por Barbería Sol. Nos quedó un lugar el jueves a las{' '}
            {row.time} con 20% de descuento. Si lo querés, reservalo acá: turnos.neriva.net/…
          </p>
          <button
            type="button"
            onClick={() => {
              setFilled([...filled, row.time])
              setOpen(
                DEMO_DAY.find((r) => !r.who && r.time !== row.time && !filled.includes(r.time))
                  ?.time ?? null,
              )
            }}
            className="h-11 rounded-full bg-[#1f8f4e] text-sm font-semibold text-white hover:opacity-90"
          >
            Mandar por WhatsApp
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFilled([])
            setOpen('11:00')
          }}
          className="h-11 rounded-full text-sm font-semibold ring-2 ring-inset ring-[var(--ink)]"
        >
          Ver de nuevo
        </button>
      )}
    </div>
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
    title: 'En el calendario de tu celular',
    text: 'Cada profesional ve sus turnos en el calendario del iPhone o en Google Calendar, junto con el resto de sus cosas.',
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

const WEB_PRICE = 29900
const WEB_SETUP = 60000
const WEB_LINK = wa(
  '¡Hola! Quiero mi propia página web con turnos (plan Turnos + Web). Mi negocio es: ',
)

function Pricing() {
  return (
    <section id="precios" className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="display text-[clamp(2.2rem,5vw,3.75rem)] font-bold">Precios claros.</h2>
      <p className="mt-4 max-w-[52ch] text-lg leading-relaxed opacity-80">
        Reservas y profesionales sin límite, agenda semanal y la ficha de tus clientes. 30 días
        gratis para probarlo con tu agenda real.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-[2rem] bg-white p-8 ring-2 ring-[var(--ink)]">
          <p className="text-lg font-semibold">Turnos</p>
          <p className="display mt-2 text-6xl font-extrabold">{pesos(PRICE)}</p>
          <p className="mt-1 opacity-70">por mes, todo incluido</p>
          <ul className="mt-6 flex flex-1 list-disc flex-col gap-2 pl-5 leading-relaxed">
            <li>Tu link de reservas para Instagram, Google Maps y WhatsApp</li>
            <li>Agenda en el celular y en la compu</li>
            <li>Llenar huecos: ofertas por WhatsApp a quien no viene hace rato</li>
            <li>Los turnos aparecen en el calendario de cada profesional</li>
          </ul>
          <a
            href={TRY_LINK}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex h-13 w-full items-center justify-center rounded-full bg-[var(--lacquer)] text-base font-semibold text-white hover:opacity-90"
          >
            Probar 30 días gratis
          </a>
          <p className="mt-3 text-center text-sm opacity-60">Si no te sirve, no pagás nada.</p>
        </div>
        <div className="flex flex-col rounded-[2rem] bg-[var(--ink)] p-8 text-white">
          <p className="text-lg font-semibold">Turnos + tu página web</p>
          <p className="display mt-2 text-6xl font-extrabold">{pesos(WEB_PRICE)}</p>
          <p className="mt-1 opacity-70">
            por mes, más {pesos(WEB_SETUP)} una sola vez por el armado
          </p>
          <ul className="mt-6 flex flex-1 list-disc flex-col gap-2 pl-5 leading-relaxed">
            <li>Todo lo del plan Turnos</li>
            <li>Tu web con fotos, servicios, precios y el botón de reservar adentro</li>
            <li>Tu dominio propio (tunegocio.com.ar): el primer año va incluido en el armado</li>
            <li>
              La armamos nosotros. Si cambiás un precio en tu agenda, la web se actualiza sola
            </li>
          </ul>
          <a
            href={WEB_LINK}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex h-13 w-full items-center justify-center rounded-full bg-white text-base font-semibold text-[var(--ink)] hover:opacity-90"
          >
            Quiero mi web
          </a>
          <p className="mt-3 text-center text-sm opacity-60">Te escribimos por WhatsApp.</p>
        </div>
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
  [
    '¿Los turnos aparecen en el calendario de mi celular?',
    'Sí. Cada profesional agrega su link al calendario del iPhone o a Google Calendar y ve sus turnos ahí, junto con el resto de sus cosas.',
  ],
  [
    '¿Puedo tener mi propia página web?',
    'Sí, con el plan Turnos + Web. La armamos nosotros con tus fotos y servicios, con tu dominio propio y los turnos adentro. El dominio queda a tu nombre.',
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
