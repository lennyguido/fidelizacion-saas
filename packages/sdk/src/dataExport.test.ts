import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv.ts'
import { customersCsv, ledgerCsv, minorToDecimal, visitsCsv } from './dataExport.ts'

describe('minorToDecimal', () => {
  it('writes amounts the way Spanish Excel reads them', () => {
    expect(minorToDecimal(150050)).toBe('1500,50')
    expect(minorToDecimal(5)).toBe('0,05')
    expect(minorToDecimal(-250)).toBe('-2,50')
    expect(minorToDecimal(null)).toBe('')
  })
})

describe('export CSVs', () => {
  it('builds the customers file with Spanish titles and values', () => {
    const rows = parseCsv(
      customersCsv([
        {
          name: 'Ana',
          phone: '+5491180000001',
          email: null,
          birth_day: 3,
          birth_month: 5,
          tags: 'vip',
          notes: '=HACK()',
          source: 'qr',
          status: 'active',
          anonymized: false,
          whatsapp_marketing: true,
          created_at: '2026-10-01 10:00',
          visit_count: 3,
          first_visit_at: '2026-10-01 10:00',
          last_visit_at: '2026-10-10 18:30',
          total_spend_minor: 450000,
          customer_status: 'AT_RISK',
        },
      ]),
    )
    expect(rows[0]?.[0]).toBe('Nombre')
    expect(rows[1]).toEqual([
      'Ana',
      '+5491180000001',
      '',
      '03/05',
      'vip',
      "'=HACK()",
      'Alta por QR',
      'No',
      'No',
      'Sí',
      '2026-10-01 10:00',
      '3',
      '2026-10-01 10:00',
      '2026-10-10 18:30',
      '4500,00',
      'En riesgo',
    ])
  })

  it('builds the visits file', () => {
    const rows = parseCsv(
      visitsCsv([
        {
          occurred_at: '2026-10-10 18:30',
          customer_name: null,
          customer_phone: null,
          location: 'Principal',
          amount_minor: null,
          currency: 'ARS',
          source: 'pos',
          notes: null,
          voided: true,
          void_reason: 'Error de carga',
        },
      ]),
    )
    expect(rows[1]).toEqual([
      '2026-10-10 18:30',
      '',
      '',
      'Principal',
      '',
      'ARS',
      'Caja',
      '',
      'Sí',
      'Error de carga',
    ])
  })

  it('builds the points file with negative deltas as numbers', () => {
    const rows = parseCsv(
      ledgerCsv([
        {
          created_at: '2026-10-10 18:30',
          customer_name: 'Ana',
          customer_phone: '+5491180000001',
          delta: -8,
          reason: 'redemption',
          reward_name: 'Café de regalo',
          note: null,
        },
      ]),
    )
    expect(rows[1]).toEqual([
      '2026-10-10 18:30',
      'Ana',
      '+5491180000001',
      '-8',
      'Canje',
      'Café de regalo',
      '',
    ])
  })
})
