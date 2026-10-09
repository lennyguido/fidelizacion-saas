import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { cn } from './cn.ts'
import { ToastContext, type ToastTone } from './toast-context.ts'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

const toneClass: Record<ToastTone, string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-slate-900',
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++
    setItems((current) => [...current, { id, tone, message }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 4000)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto w-full max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg',
              toneClass[item.tone],
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
