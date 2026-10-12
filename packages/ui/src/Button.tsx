import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn.ts'
import { Spinner } from './Spinner.tsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const variants: Record<Variant, string> = {
  // Un solo color de acción (#0071e3) en el botón lleno; el resto, azul de link o gris.
  primary: 'bg-action text-white hover:bg-action-hover disabled:bg-slate-300',
  secondary:
    'bg-transparent text-link ring-1 ring-inset ring-link hover:bg-white disabled:text-slate-400 disabled:ring-slate-300',
  ghost: 'text-link hover:bg-white disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300',
}

const sizes: Record<Size, string> = {
  md: 'min-h-10 px-[21px] py-[11px] text-sm',
  lg: 'min-h-12 px-6 py-3 text-[17px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-normal transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
