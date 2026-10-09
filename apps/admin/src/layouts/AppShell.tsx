import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { auth, type MyBusiness } from '@plataforma/sdk'
import { cn } from '@plataforma/ui'
import { useActiveBusiness } from '../features/business/ActiveBusinessContext'
import { moduleManifests } from '../modules/registry'

interface NavItem {
  label: string
  to: string
  end?: boolean
}

function useNavItems(): NavItem[] {
  const { business, modules } = useActiveBusiness()
  const base = `/b/${business.slug}`
  const moduleItems = moduleManifests
    .filter((m) => modules.includes(m.id))
    .flatMap((m) => m.nav.map((item) => ({ label: item.label, to: `${base}/${item.path}` })))
  return [
    { label: 'Inicio', to: base, end: true },
    { label: 'Mostrador', to: `${base}/mostrador` },
    { label: 'Clientes', to: `${base}/clientes` },
    ...moduleItems,
    ...(business.role === 'staff' ? [] : [{ label: 'Mi negocio', to: `${base}/negocio` }]),
  ]
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
  )
}

function BusinessSwitcher({ businesses }: { businesses: MyBusiness[] }) {
  const { business } = useActiveBusiness()
  const navigate = useNavigate()

  if (businesses.length < 2) {
    return <span className="truncate font-semibold text-slate-900">{business.name}</span>
  }
  return (
    <select
      aria-label="Cambiar de negocio"
      value={business.slug}
      onChange={(e) => navigate(`/b/${e.target.value}`)}
      className="max-w-[60vw] truncate rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold"
    >
      {businesses.map((b) => (
        <option key={b.id} value={b.slug}>
          {b.name}
        </option>
      ))}
    </select>
  )
}

/** Panel del negocio: mobile-first (menú horizontal arriba), barra lateral en desktop. */
export function AppShell({
  businesses,
  children,
}: {
  businesses: MyBusiness[]
  children: ReactNode
}) {
  const items = useNavItems()

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-4 px-1">
          <BusinessSwitcher businesses={businesses} />
        </div>
        <nav className="flex flex-col gap-1" aria-label="Principal">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="mt-auto rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
        >
          Salir
        </button>
      </aside>

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <BusinessSwitcher businesses={businesses} />
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="text-sm text-slate-500"
          >
            Salir
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Principal">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  )
}
