import { businesses, type PublicPage } from '@plataforma/sdk'

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
/** La semana arranca el lunes. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const DEFAULT_HEADLINE = 'Reservá tu turno en'

/** Portada de la página de reservas: con foto del local o con el color del negocio. */
export function PageHero({ page }: { page: PublicPage }) {
  const logo = businesses.logoUrl(page.logoPath)
  const cover = businesses.logoUrl(page.coverPath ?? null)
  const body = (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-10 pb-8">
      {logo && (
        <img
          src={logo}
          alt=""
          className="h-16 w-16 rounded-2xl bg-white object-cover ring-2 ring-white/40"
        />
      )}
      <div>
        <p className="text-sm font-semibold opacity-85">{page.headline || DEFAULT_HEADLINE}</p>
        <h1 className="display mt-1 text-[clamp(2.6rem,12vw,4.25rem)] font-bold break-words">
          {page.name}
        </h1>
      </div>
      {page.message && <p className="max-w-[40ch] leading-relaxed opacity-90">{page.message}</p>}
    </div>
  )

  if (!cover) return <header className="bg-[var(--brand)] text-[var(--on-brand)]">{body}</header>
  return (
    <header className="relative isolate overflow-hidden bg-[var(--ink)] text-white">
      <img src={cover} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/45 to-black/10" />
      <div className="flex min-h-[340px] flex-col justify-end pt-24">{body}</div>
    </header>
  )
}

/** "Sobre el local": texto, horarios, cómo llegar y redes. Solo muestra lo que cargó. */
export function PageInfo({ page, today }: { page: PublicPage; today?: number }) {
  const hours = page.hours ?? []
  const hasLinks = page.address || page.instagram || page.whatsapp
  if (!page.about && hours.length === 0 && !hasLinks) return null
  const whatsapp = page.whatsapp?.replace(/\D/g, '')

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-white p-5">
      <h2 className="display text-2xl font-bold">Sobre {page.name}</h2>
      {page.about && <p className="leading-relaxed whitespace-pre-line opacity-80">{page.about}</p>}

      {hours.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold opacity-60">Horarios</h3>
          <ul className="flex flex-col text-[15px]">
            {WEEK_ORDER.map((day) => {
              const open = hours.find((h) => h.weekday === day)
              return (
                <li
                  key={day}
                  className={`flex justify-between border-t border-[var(--line)] py-1.5 first:border-t-0 ${
                    day === today ? 'font-semibold text-[var(--brand)]' : ''
                  }`}
                >
                  <span>{WEEKDAYS[day]}</span>
                  <span className="tabular-nums">
                    {open ? `${open.opens} a ${open.closes}` : 'Cerrado'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {hasLinks && (
        <div className="flex flex-col gap-2">
          {page.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${page.address}`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="info-link"
            >
              <PinIcon />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{page.address}</span>
                <span className="block text-sm opacity-60">Cómo llegar</span>
              </span>
            </a>
          )}
          {page.instagram && (
            <a
              href={`https://instagram.com/${page.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="info-link"
            >
              <CameraIcon />
              <span className="font-semibold">@{page.instagram}</span>
            </a>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="info-link"
            >
              <ChatIcon />
              <span className="font-semibold">Escribinos por WhatsApp</span>
            </a>
          )}
        </div>
      )}
    </section>
  )
}

/** Foto o inicial de un profesional. */
export function StaffAvatar({
  name,
  photoPath,
  className = 'h-16 w-16 text-2xl',
}: {
  name: string
  photoPath?: string | null
  className?: string
}) {
  const photo = businesses.logoUrl(photoPath ?? null)
  if (photo) return <img src={photo} alt="" className={`${className} rounded-full object-cover`} />
  return (
    <span
      className={`${className} display flex items-center justify-center rounded-full bg-[var(--paper)] font-bold`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'shrink-0 text-[var(--brand)]',
}

function PinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.3L4 20z" />
    </svg>
  )
}
