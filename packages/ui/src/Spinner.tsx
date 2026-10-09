import { cn } from './cn.ts'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-slate-400">
      <Spinner className="size-8" />
    </div>
  )
}
