import { buyLink } from '../lib/plans'

const RUBROS = [
  'Cafeterías',
  'Barberías',
  'Panaderías',
  'Heladerías',
  'Petshops',
  'Dietéticas',
  'Verdulerías',
  'Peluquerías',
]

/** Cinta con los rubros. */
export function Marquee() {
  const items = [...RUBROS, ...RUBROS]
  return (
    <div className="overflow-hidden border-y border-noche/10 bg-mostaza py-4" aria-hidden="true">
      <div className="marquee flex w-max gap-10 font-display text-2xl font-bold whitespace-nowrap">
        {items.map((rubro, i) => (
          <span key={i} className="flex items-center gap-10">
            {rubro}
            <span className="font-serif text-terracota italic">✶</span>
          </span>
        ))}
      </div>
    </div>
  )
}

const PROBLEMS = [
  {
    n: '01',
    title: 'Se van sin avisar',
    text: 'Un día dejan de venir y nadie se da cuenta. Para cuando lo notás, ya tienen otro café.',
  },
  {
    n: '02',
    title: 'Las tarjetitas de cartón se pierden',
    text: 'Y no te dicen nada: ni quién vino, ni cuánto gastó, ni quién está por dejar de venir.',
  },
  {
    n: '03',
    title: 'Los descuentos para todos no sirven',
    text: 'Regalás plata al que igual iba a venir. Neriva premia al que vuelve y busca al que se fue.',
  },
]

export function Problems() {
  return (
    <section className="px-5 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="reveal max-w-3xl font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
          Conseguir un cliente cuesta.{' '}
          <span className="font-serif font-normal text-terracota italic">Perderlo</span>, no hace
          ruido.
        </h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <article key={p.n} className="reveal border-t-2 border-noche pt-6">
              <p className="font-serif text-4xl text-terracota italic">{p.n}</p>
              <h3 className="mt-3 font-display text-2xl font-bold">{p.title}</h3>
              <p className="mt-3 leading-relaxed text-piedra">{p.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { title: 'Elegís tu plan', text: 'Nos escribís por WhatsApp y arreglamos el pago.' },
  {
    title: 'Te llega el acceso',
    text: 'Un mail a tu correo para elegir tu contraseña. Nadie más puede entrar.',
  },
  {
    title: 'Pegás el cartel',
    text: 'Tus clientes escanean el QR, se anotan solos y empiezan a sumar sellos.',
  },
]

export function HowToStart() {
  return (
    <section className="px-5 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="reveal font-serif text-2xl text-terracota italic">Cómo empezás</p>
        <h2 className="reveal mt-2 font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
          Tres pasos y tu local ya está andando.
        </h2>
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="reveal rounded-[1.75rem] bg-white p-8 ring-1 ring-noche/10"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-terracota font-display text-xl font-bold text-crema">
                {i + 1}
              </span>
              <h3 className="mt-5 font-display text-2xl font-bold">{step.title}</h3>
              <p className="mt-2 text-piedra">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const FAQ = [
  {
    q: '¿Mis clientes tienen que bajar una app?',
    a: 'No. Reciben un link con su tarjeta y la pueden guardar en la pantalla de inicio o en la billetera del celular.',
  },
  {
    q: '¿Y si no sé de computadoras?',
    a: 'Si sabés usar WhatsApp, sabés usar Neriva. Te lo dejamos instalado y te enseñamos a vos y a tu equipo.',
  },
  {
    q: '¿Le mandan mensajes a cualquiera?',
    a: 'Solo a quien aceptó recibirlos, y se puede dar de baja cuando quiera. Cumplimos la Ley 25.326 de datos personales.',
  },
  {
    q: '¿Puedo probar antes de pagar?',
    a: 'Escribinos y te mostramos tu propio local funcionando. Y si en un mes no volvió ni un cliente, ese mes no lo pagás.',
  },
  {
    q: '¿Los datos de mis clientes son míos?',
    a: 'Sí. Los podés exportar cuando quieras en un archivo para Excel.',
  },
]

export function Faq() {
  return (
    <section className="px-5 py-24 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h2 className="reveal font-display text-[clamp(2rem,4.5vw,3.2rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
          Preguntas de mostrador
        </h2>
        <div className="mt-10 divide-y divide-noche/10 border-y border-noche/10">
          {FAQ.map((item) => (
            <details key={item.q} className="reveal group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-bold">
                {item.q}
                <span className="text-2xl text-terracota transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-piedra">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="px-5 pb-24 md:px-10">
      <div className="reveal mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] bg-terracota px-8 py-16 text-center text-crema md:px-16">
        <h2 className="font-display text-[clamp(2.2rem,6vw,4.6rem)] leading-[0.92] font-extrabold tracking-[-0.03em]">
          El cliente que se fue <span className="font-serif font-normal italic">puede volver</span>.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-crema/85">
          Escribinos y en 20 minutos dejamos tu local andando.
        </p>
        <a
          href={buyLink(null)}
          target="_blank"
          rel="noreferrer"
          className="mt-9 inline-block rounded-full bg-noche px-8 py-4 font-semibold text-crema transition hover:-translate-y-0.5"
        >
          Hablar por WhatsApp
        </a>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-noche/10 px-5 py-10 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-piedra">
        <p className="font-display text-xl font-extrabold text-noche">
          neriva<span className="text-terracota">.</span>
        </p>
        <p>Hecho en Argentina para los locales de barrio.</p>
        <a
          href="https://panel.neriva.net"
          className="font-semibold text-noche underline-offset-4 hover:underline"
        >
          Ya soy cliente · Entrar
        </a>
      </div>
    </footer>
  )
}
