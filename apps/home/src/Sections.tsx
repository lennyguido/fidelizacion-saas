import type { ReactNode } from 'react'
import { Logo } from './Header'
import { LineMap } from './LineMap'
import { PRODUCTS } from './products'
import { BUNDLE, SINGLE_PLANS, STORE_URL, formatPrice, whatsappLink, type Plan } from './site'

function Section({
  id,
  title,
  intro,
  children,
  className = '',
}: {
  id?: string
  title: string
  intro?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24 ${className}`}>
      <h2 className="wide max-w-[18ch] text-[clamp(2rem,6vw,3.25rem)]">{title}</h2>
      {intro && <p className="mt-4 max-w-[56ch] text-lg text-muted">{intro}</p>}
      <div className="mt-10 md:mt-14">{children}</div>
    </section>
  )
}

export function Hero() {
  return (
    <section id="inicio" className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 md:pt-24">
      <h1 className="wide max-w-[16ch] text-[clamp(2.4rem,8vw,4.75rem)]">
        Todo lo que tu local necesita, en una misma línea.
      </h1>
      <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-muted md:text-xl">
        Turnos online, clientes que vuelven y tu web. Neriva conecta las herramientas para
        peluquerías, barberías, cafés y panaderías del barrio, y te las deja andando.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href="#contacto" className="btn btn-primary">
          Quiero que me lo muestren
        </a>
        <a href="#planes" className="btn btn-ghost">
          Ver planes
        </a>
      </div>
      <div className="mt-16 md:mt-20">
        <LineMap />
      </div>
    </section>
  )
}

export function Products() {
  return (
    <Section id="productos" title="Cada estación, una herramienta">
      <ol className="flex flex-col gap-16">
        {PRODUCTS.map((product) => (
          <li key={product.id} className="route-stop">
            <span className="route-dot" aria-hidden />
            <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
              <div>
                <h3 className="wide text-[1.75rem] md:text-4xl">{product.name}</h3>
                <p className="mt-2 text-lg font-semibold text-line">{product.tagline}</p>
              </div>
              <div className="md:pt-1">
                <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
                  {product.description}
                </p>
                <a href={product.href} className="text-link mt-2">
                  {product.linkLabel}
                </a>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

const STEPS = [
  { title: 'Saca turno solo', text: 'Entra a tu página desde el celular y elige día y hora.' },
  { title: 'Viene y suma un sello', text: 'En su tarjeta del celular, sin bajar ninguna app.' },
  {
    title: 'Si deja de venir, te enterás',
    text: 'Te avisamos y te armamos el WhatsApp para invitarlo a volver.',
  },
  { title: 'Vuelve', text: 'Y ves cuánta plata volvió gracias a ese mensaje.' },
]

export function Journey() {
  return (
    <div className="border-y border-rule bg-station">
      <Section
        title="Del primer turno al cliente de siempre"
        intro="Así viaja un cliente por la línea, con Turnos y Fidelización juntos."
      >
        <ol className="grid lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="trip-stop">
              <span className="trip-num" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="mt-2 max-w-[30ch] leading-relaxed text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}

function planLink(plan: Plan) {
  return whatsappLink(`Hola, me interesa el plan ${plan.name} de Neriva.`)
}

export function Plans() {
  return (
    <Section
      id="planes"
      title="Juntos salen menos"
      intro={
        <>
          Precios por mes, en pesos, para un local. ¿Tenés más de una sucursal?{' '}
          <a
            href="https://fidelizacion.neriva.net/#planes"
            className="font-semibold text-ink underline decoration-line decoration-2 underline-offset-4"
          >
            Mirá los planes para varios locales
          </a>
          .
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <article className="flex flex-col gap-6 rounded-[28px] bg-line p-7 text-white md:p-10">
          <div>
            <h3 className="wide text-3xl md:text-4xl">{BUNDLE.name}</h3>
            <p className="mt-1 text-lg text-white/85">{BUNDLE.includes}</p>
          </div>
          <p>
            <span className="wide text-5xl md:text-6xl">{formatPrice(BUNDLE.price)}</span>
            <span className="ml-2 text-white/85">por mes</span>
          </p>
          {BUNDLE.note && <p className="max-w-[40ch] text-lg">{BUNDLE.note}</p>}
          <a
            href={planLink(BUNDLE)}
            target="_blank"
            rel="noreferrer"
            className="btn mt-auto w-fit bg-white text-line hover:bg-paper"
          >
            Quiero el paquete
          </a>
        </article>
        <div className="flex flex-col gap-4">
          {SINGLE_PLANS.map((plan) => (
            <article
              key={plan.id}
              className="flex flex-1 flex-col gap-3 rounded-[28px] border-2 border-rule bg-station p-6"
            >
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p>
                <span className="wide text-3xl">{formatPrice(plan.price)}</span>
                <span className="ml-2 text-muted">por mes</span>
              </p>
              <a
                href={planLink(plan)}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex min-h-11 w-fit items-center font-bold underline decoration-line decoration-2 underline-offset-4 hover:text-line"
              >
                Consultar por {plan.name.replace('Solo ', '')}
              </a>
            </article>
          ))}
        </div>
      </div>
    </Section>
  )
}

const CARE = [
  {
    title: 'Cargamos todo por vos',
    text: 'Tus servicios, horarios y profesionales. Vos no tocás nada para arrancar.',
  },
  {
    title: 'Te enseñamos en tu local',
    text: 'Vamos y te mostramos cómo usarlo, a vos y a tu equipo, con tus clientes de verdad.',
  },
  { title: 'Si algo falla, vamos a verte', text: 'No te dejamos solo con un sistema que no anda.' },
]

export function Care() {
  return (
    <Section title="No te damos un sistema. Te lo dejamos andando.">
      <div className="grid gap-8 border-t-2 border-ink pt-8 md:grid-cols-3">
        {CARE.map((item) => (
          <div key={item.title}>
            <h3 className="text-xl font-bold">{item.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{item.text}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function Contact() {
  return (
    <section id="contacto" className="border-t border-rule">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        {/* La línea termina acá: la última estación es tu local. */}
        <div className="terminal" aria-hidden>
          <span className="terminal-line" />
          <span className="terminal-dot" />
          <span className="wide text-xl md:text-2xl">Tu local</span>
        </div>
        <div className="mt-12 flex flex-col items-start gap-6 md:mt-16">
          <h2 className="wide max-w-[14ch] text-[clamp(2.4rem,8vw,4.5rem)]">
            ¿Lo vemos en tu local?
          </h2>
          <p className="max-w-[46ch] text-lg text-muted">
            Escribinos y pasamos a mostrarte cómo quedaría con tus servicios y tus horarios.
          </p>
          <a
            href={whatsappLink('Hola, quiero que me muestren Neriva en mi local.')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            Escribir por WhatsApp
          </a>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
      <div>
        <Logo />
        <p className="mt-2 text-muted">Buenos Aires, Argentina</p>
      </div>
      <nav aria-label="Pie de página" className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
        {PRODUCTS.map((product) => (
          <a
            key={product.id}
            href={product.href}
            className="flex min-h-11 items-center text-muted hover:text-ink"
          >
            {product.name}
          </a>
        ))}
        <a href={STORE_URL} className="flex min-h-11 items-center text-muted hover:text-ink">
          Tienda Neriva
        </a>
        <a href="#contacto" className="flex min-h-11 items-center text-muted hover:text-ink">
          Contacto
        </a>
      </nav>
    </footer>
  )
}
