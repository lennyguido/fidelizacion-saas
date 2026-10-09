import { Link } from 'react-router'
import { EmptyState } from '@plataforma/ui'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center p-6">
      <EmptyState
        title="Página no encontrada"
        action={
          <Link to="/" className="text-sm font-medium text-slate-900 underline">
            Volver al inicio
          </Link>
        }
      />
    </main>
  )
}
