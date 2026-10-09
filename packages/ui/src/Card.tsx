import type { HTMLAttributes } from 'react'
import { cn } from './cn.ts'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}
      {...rest}
    />
  )
}
