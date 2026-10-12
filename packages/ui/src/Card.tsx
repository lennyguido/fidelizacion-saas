import type { HTMLAttributes } from 'react'
import { cn } from './cn.ts'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-white p-5', className)} {...rest} />
}
