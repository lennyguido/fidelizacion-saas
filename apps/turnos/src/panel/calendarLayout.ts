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

export interface Placed<T> {
  item: T
  lane: number
  lanes: number
}

/**
 * Reparte los turnos de un día en columnas para que los que se superponen queden
 * lado a lado (como Google Calendar). `lanes` es cuántas columnas tiene su grupo.
 */
export function placeInLanes<T>(items: T[], start: (t: T) => number, end: (t: T) => number) {
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a))
  const placed: Placed<T>[] = []
  let group: Placed<T>[] = []
  let laneEnds: number[] = []
  let groupEnd = -Infinity

  const closeGroup = () => {
    for (const p of group) p.lanes = laneEnds.length
    group = []
    laneEnds = []
  }

  for (const item of sorted) {
    if (start(item) >= groupEnd) closeGroup()
    let lane = laneEnds.findIndex((e) => e <= start(item))
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end(item))
    } else {
      laneEnds[lane] = end(item)
    }
    const p = { item, lane, lanes: 1 }
    group.push(p)
    placed.push(p)
    groupEnd = Math.max(groupEnd, end(item))
  }
  closeGroup()
  return placed
}
