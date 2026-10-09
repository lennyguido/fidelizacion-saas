import { QueryClient } from '@tanstack/react-query'
import { AppError } from '@plataforma/sdk'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No reintentar errores que no se arreglan solos (permisos, datos inválidos).
      retry: (failureCount, error) =>
        !(
          error instanceof AppError && ['forbidden', 'not_found', 'invalid'].includes(error.code)
        ) && failureCount < 2,
    },
  },
})
