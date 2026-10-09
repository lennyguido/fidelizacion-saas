import type { CustomerStatus } from '@plataforma/sdk'
import { cn } from '@plataforma/ui'
import { statusInfo } from './status'

export function StatusBadge({ status }: { status: CustomerStatus }) {
  const info = statusInfo[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        info.badge,
      )}
    >
      {info.label}
    </span>
  )
}
