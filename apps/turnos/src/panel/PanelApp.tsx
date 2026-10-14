import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auth, booking, businesses, errorMessage, type Session } from '@plataforma/sdk'
import { Alert, Button, FullPageSpinner, TextField, ToastProvider } from '@plataforma/ui'
import { CalendarPage } from './CalendarPage'
import { ClientsPage } from './ClientsPage'
import { FillGapsPage } from './FillGapsPage'
import { PanelContext, usePanel } from './context'
import { BookingSetupPage } from './SetupPage'

const VIEWS = [
  { path: '/panel', label: 'Calendario' },
  { path: '/panel/huecos', label: 'Llenar huecos' },
  { path: '/panel/clientes', label: 'Clientes' },
  { path: '/panel/configuracion', label: 'Configuración' },
] as const

const LAST_BUSINESS = 'turnos.lastBusiness'

/**
 * Panel de Turnos (D-050), separado del panel de Neriva: misma cuenta, su propia
 * dirección (turnos.neriva.net/panel) y solo lo de turnos.
 */
export function PanelApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    void auth.getSession().then(setSession)
    return auth.onAuthChange((_event, next) => setSession(next))
  }, [])

  if (session === undefined) return <FullPageSpinner />
  return <ToastProvider>{session ? <SignedIn session={session} /> : <LoginScreen />}</ToastProvider>
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await auth.signIn(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Neriva Turnos</p>
        <h1 className="text-2xl font-bold tracking-tight">Entrá a tu agenda</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="lg" loading={busy} disabled={!email || !password}>
          Ingresar
        </Button>
      </form>
      <p className="text-sm text-slate-600">
        Es la misma cuenta de Neriva.{' '}
        <a href="https://panel.neriva.net/forgot-password" className="underline">
          Olvidé mi contraseña
        </a>
      </p>
    </main>
  )
}

function SignedIn({ session }: { session: Session }) {
  const list = useQuery({
    queryKey: ['panel', 'businesses', session.user.id],
    queryFn: () => businesses.listMyBusinesses(session.user.id),
  })
  const [businessId, setBusinessIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_BUSINESS)
    } catch {
      return null
    }
  })

  if (list.isPending) return <FullPageSpinner />
  if (list.error) return <Alert tone="error">{errorMessage(list.error)}</Alert>
  const all = list.data ?? []
  if (all.length === 0) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="text-2xl font-bold">Todavía no tenés un negocio</h1>
        <p className="text-slate-600">Para usar Turnos, escribinos y te damos acceso en el día.</p>
        <Button variant="secondary" onClick={() => void auth.signOut()}>
          Salir
        </Button>
      </main>
    )
  }
  const business = all.find((b) => b.id === businessId) ?? all[0]!
  const setBusinessId = (id: string) => {
    setBusinessIdState(id)
    try {
      localStorage.setItem(LAST_BUSINESS, id)
    } catch {
      // Sin almacenamiento: se elige de nuevo la próxima vez.
    }
  }

  return (
    <PanelContext.Provider
      value={{ business, businesses: all, setBusinessId, email: session.user.email ?? '' }}
    >
      <Shell />
    </PanelContext.Provider>
  )
}

function usePath(): [string, (path: string) => void] {
  const [path, setPath] = useState(window.location.pathname.replace(/\/+$/, ''))
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname.replace(/\/+$/, ''))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = (next: string) => {
    window.history.pushState(null, '', next)
    setPath(next)
  }
  return [path, go]
}

function Shell() {
  const { business, businesses: all, setBusinessId } = usePanel()
  const [path, go] = usePath()
  const view = VIEWS.find((v) => v.path === path) ?? VIEWS[0]

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="font-semibold">Turnos</span>
          {all.length > 1 ? (
            <select
              aria-label="Negocio"
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              value={business.id}
              onChange={(e) => setBusinessId(e.target.value)}
            >
              {all.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-600">{business.name}</span>
          )}
          <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
            {VIEWS.map((v) => (
              <button
                key={v.path}
                type="button"
                onClick={() => go(v.path)}
                aria-current={v.path === view.path ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                  v.path === view.path
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {v.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <a
              href={booking.publicBookingUrl(business.slug)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Mi página de reservas
            </a>
            <button type="button" className="text-slate-500" onClick={() => void auth.signOut()}>
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {view.path === '/panel' && <CalendarPage />}
        {view.path === '/panel/huecos' && <FillGapsPage />}
        {view.path === '/panel/clientes' && <ClientsPage />}
        {view.path === '/panel/configuracion' && <BookingSetupPage />}
      </main>
    </div>
  )
}
