import type { AutomationKind } from '@plataforma/sdk'

/** Textos de cada automatización (D-031). */
export const AUTOMATION_INFO: Record<
  AutomationKind,
  { title: string; description: string; daysLabel: string }
> = {
  at_risk: {
    title: 'Clientes en riesgo',
    description:
      'Le escribe a quien venía seguido y tarda el doble de lo habitual en volver. Una sola vez por ausencia.',
    daysLabel: 'Mínimo de días sin venir',
  },
  second_visit: {
    title: 'Segunda visita',
    description: 'Le escribe a quien vino una sola vez, unos días después, para que vuelva.',
    daysLabel: 'Días después de la primera visita',
  },
  birthday: {
    title: 'Cumpleaños',
    description: 'Saluda el día del cumpleaños (se carga en la ficha del cliente).',
    daysLabel: 'Días de anticipación (0 = el mismo día)',
  },
}
