/** Fecha en la zona horaria del negocio: "8 oct 2026, 14:35". */
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** "hoy", "ayer", "hace 5 días". */
export function formatDaysAgo(iso: string | null): string {
  if (!iso) return 'Nunca'
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}
