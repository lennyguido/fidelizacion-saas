import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { initSupabase, readPublicEnv } from '@plataforma/sdk'
import { ErrorBoundary } from '@plataforma/ui'
import { App } from '@/App'
import '@/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontró el elemento #root')

let configError: string | null = null
try {
  initSupabase(readPublicEnv(import.meta.env))
} catch (error) {
  configError = error instanceof Error ? error.message : String(error)
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
})

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      {configError ? (
        <p className="p-6 text-sm text-red-700">Falta configuración: {configError}</p>
      ) : (
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
