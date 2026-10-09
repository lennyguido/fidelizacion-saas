import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn.ts'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string | null
  hint?: ReactNode
}

/** Input con label, ayuda y error accesibles. */
export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'h-11 rounded-lg border bg-white px-3 text-base text-slate-900 shadow-sm',
          'placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0',
          error
            ? 'border-red-400 focus:outline-red-500'
            : 'border-slate-300 focus:outline-slate-900',
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
