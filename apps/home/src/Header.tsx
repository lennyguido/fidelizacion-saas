import { useState } from 'react'
import { STORE_URL, whatsappLink } from './site'

const LINKS = [
  { href: '#productos', label: 'Productos' },
  { href: '#planes', label: 'Planes' },
  { href: '#contacto', label: 'Contacto' },
]

const CONTACT_TEXT = 'Hola, quiero saber más sobre Neriva para mi local.'

export function Logo() {
  return (
    <a href="#inicio" className="wide flex min-h-11 items-center gap-2.5 text-2xl">
      <span className="badge size-8 text-lg" aria-hidden>
        N
      </span>
      neriva
    </a>
  )
}

export function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2 sm:px-6">
        <Logo />
        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex min-h-11 items-center rounded-full px-3 font-medium text-muted hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={STORE_URL}
            className="hidden min-h-11 items-center px-3 font-medium text-muted hover:text-ink md:flex"
          >
            Tienda Neriva
          </a>
          <a
            href={whatsappLink(CONTACT_TEXT)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            Escribinos
          </a>
          <button
            type="button"
            className="flex size-12 items-center justify-center rounded-full md:hidden"
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen(!open)}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              {open ? (
                <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2.2" />
              ) : (
                <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2.2" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="menu-movil"
          aria-label="Menú"
          className="flex flex-col border-t border-rule px-4 pb-3 md:hidden"
        >
          {[...LINKS, { href: STORE_URL, label: 'Tienda Neriva' }].map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center border-b border-rule text-lg font-medium last:border-b-0"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
