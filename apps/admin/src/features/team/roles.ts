import type { MemberRole } from '@plataforma/sdk'

export const roleLabels: Record<MemberRole, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  staff: 'Empleado',
}

export const roleDescriptions: Record<'admin' | 'staff', string> = {
  staff: 'Registra visitas y carga clientes.',
  admin: 'Además importa clientes, anula visitas, archiva clientes e invita empleados.',
}
