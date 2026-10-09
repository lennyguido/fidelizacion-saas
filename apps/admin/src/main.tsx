import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { initSupabase, readPublicEnv } from '@plataforma/sdk'
import { ErrorBoundary, ToastProvider } from '@plataforma/ui'
import { ConfigError } from '@/app/ConfigError'
import { router } from '@/app/router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { queryClient } from '@/lib/queryClient'
import '@/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontró el elemento #root')
const root = createRoot(rootElement)

let configError: string | null = null
try {
  initSupabase(readPublicEnv(import.meta.env))
} catch (error) {
  configError = error instanceof Error ? error.message : String(error)
}

root.render(
  <StrictMode>
    <ErrorBoundary>
      {configError ? (
        <ConfigError message={configError} />
      ) : (
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
