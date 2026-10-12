import { describe, expect, it } from 'vitest'
import { actionText, whatsappText, type WeeklyDigest } from './weeklyDigest.ts'

const digest: WeeklyDigest = {
  weekStart: '2026-10-05',
  weekEnd: '2026-10-11',
  businessPhone: '+5491100000000',
  visits: 5,
  identifiedVisits: 1,
  baselineVisits: 10,
  baselineWeeks: 8,
  visitsDropAlert: true,
  newCustomers: 2,
  recoveredCustomers: 1,
  atRiskRegulars: [
    { customerId: 'a', name: 'Ana', phone: null, visitCount: 12, lastVisitAt: null },
    { customerId: 'b', name: 'Beto', phone: null, visitCount: 9, lastVisitAt: null },
  ],
  sameStaffAlerts: [],
  voids: 0,
  voidsAlert: false,
  action: { kind: 'contact_at_risk', customerId: 'a', name: 'Ana' },
}

describe('weekly digest', () => {
  it('builds the WhatsApp message with the week, numbers and one action', () => {
    expect(whatsappText(digest, 'Café Sol')).toBe(
      [
        'Resumen de Café Sol (5/10 al 11/10)',
        '• Visitas: 5 (lo normal: 10)',
        '• Clientes nuevos: 2',
        '• Recuperados: 1',
        '⚠️ Las visitas bajaron más de 20 %.',
        '• En riesgo: Ana, Beto',
        '👉 Escribile a Ana: venía seguido y dejó de venir.',
      ].join('\n'),
    )
  })

  it('omits the comparison when there is no baseline', () => {
    const text = whatsappText(
      { ...digest, baselineVisits: null, visitsDropAlert: false, atRiskRegulars: [] },
      'Café Sol',
    )
    expect(text).toContain('• Visitas: 5\n')
    expect(text).not.toContain('En riesgo')
  })

  it('has a text for every action', () => {
    for (const kind of [
      'load_visits',
      'review_alerts',
      'contact_at_risk',
      'turn_on_automations',
      'ask_phone',
      'keep_going',
    ] as const) {
      expect(actionText({ kind })).not.toBe('')
    }
  })
})
