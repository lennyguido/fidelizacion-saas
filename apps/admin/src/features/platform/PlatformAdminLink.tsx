import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { access } from '@plataforma/sdk'

/** Link a "Accesos": solo lo ve el administrador de la plataforma (D-043). */
export function PlatformAdminLink() {
  const admin = useQuery({ queryKey: ['platform-admin'], queryFn: () => access.isPlatformAdmin() })
  if (!admin.data) return null
  return (
    <Link
      to="/admin/accesos"
      className="rounded-full px-3 py-1.5 text-sm text-link hover:bg-slate-100"
    >
      Accesos (Neriva)
    </Link>
  )
}
