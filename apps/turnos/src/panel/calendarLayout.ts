/** Colores por profesional: borde fuerte + fondo suave (se reparten en orden). */
export const STAFF_COLORS = [
  { bar: '#2563eb', bg: '#eff6ff' },
  { bar: '#059669', bg: '#ecfdf5' },
  { bar: '#7c3aed', bg: '#f5f3ff' },
  { bar: '#d97706', bg: '#fffbeb' },
  { bar: '#db2777', bg: '#fdf2f8' },
  { bar: '#0891b2', bg: '#ecfeff' },
] as const

export type StaffColor = (typeof STAFF_COLORS)[number]

export function staffColor(staffIds: string[], staffId: string): StaffColor {
  const index = staffIds.indexOf(staffId)
  return STAFF_COLORS[(index < 0 ? 0 : index) % STAFF_COLORS.length]!
}
