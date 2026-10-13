import { describe, expect, it } from 'vitest'
import type { PlanInfo } from './businesses.ts'
import { isAtLimit, isNearLimit, planWithFeature, planWithMore, upgradeLink } from './plans.ts'

const barrio: PlanInfo = {
  planId: 'barrio',
  name: 'Barrio',
  features: {
    automations: false,
    selfSignup: false,
    cashRegister: false,
    maxCustomers: 1000,
    maxStaff: 2,
    maxLocations: 1,
  },
  usage: { customers: 0, staff: 0, locations: 1 },
}

describe('planes', () => {
  it('ofrece el plan más barato que incluye la función', () => {
    expect(planWithFeature('barrio', 'automations')?.id).toBe('local')
    expect(planWithFeature('barrio', 'cashRegister')?.id).toBe('cadena')
    expect(planWithFeature('cadena', 'automations')).toBeNull()
  })

  it('ofrece el plan que deja sumar más', () => {
    expect(planWithMore('barrio', 'maxStaff', 2)?.id).toBe('local')
    expect(planWithMore('local', 'maxStaff', 5)?.id).toBe('cadena')
    expect(planWithMore('barrio', 'maxLocations', 1)?.id).toBe('cadena')
    expect(planWithMore('cadena', 'maxLocations', 5)).toBeNull()
  })

  it('detecta el tope y cuando falta poco', () => {
    expect(isAtLimit(barrio, 'maxStaff', 2)).toBe(true)
    expect(isAtLimit(barrio, 'maxStaff', 1)).toBe(false)
    expect(isNearLimit(barrio, 'maxCustomers', 800)).toBe(true)
    expect(isNearLimit(barrio, 'maxCustomers', 799)).toBe(false)
    expect(isNearLimit(barrio, 'maxCustomers', 1000)).toBe(false)
  })

  it('arma el pedido por WhatsApp', () => {
    const link = upgradeLink(planWithFeature('barrio', 'automations')!, 'Café Sol', 'sumar gente')
    expect(link.startsWith('https://wa.me/5491128330853?text=')).toBe(true)
    expect(decodeURIComponent(link)).toContain('Café Sol al plan Local ($44.900/mes)')
  })
})
