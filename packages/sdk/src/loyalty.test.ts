import { describe, expect, it } from 'vitest'
import { describeProgram, isRewardAvailable, type Program, type Reward } from './loyalty.ts'

const money = (minor: number) => `$${minor / 100}`

const base: Program = {
  businessId: 'b',
  enabled: true,
  kind: 'points',
  pointsPerVisit: 1,
  pointsPerAmount: 0,
  amountStepMinor: null,
  minAmountMinor: 0,
}

describe('describeProgram', () => {
  it('describes points per visit', () => {
    expect(describeProgram(base, money)).toBe('1 punto por visita')
  })
  it('describes points per amount with a minimum', () => {
    expect(
      describeProgram(
        {
          ...base,
          pointsPerVisit: 0,
          pointsPerAmount: 2,
          amountStepMinor: 100000,
          minAmountMinor: 500000,
        },
        money,
      ),
    ).toBe('2 puntos cada $1000 (compras desde $5000)')
  })
  it('uses stamps wording', () => {
    expect(describeProgram({ ...base, kind: 'stamps' }, money)).toBe('1 sello por visita')
  })
})

describe('isRewardAvailable', () => {
  const reward: Reward = {
    id: 'r',
    name: 'Café',
    description: null,
    costPoints: 10,
    active: true,
    availableUntil: null,
  }
  it('is available when active without end date', () => {
    expect(isRewardAvailable(reward)).toBe(true)
  })
  it('is not available when inactive or expired', () => {
    expect(isRewardAvailable({ ...reward, active: false })).toBe(false)
    expect(
      isRewardAvailable(
        { ...reward, availableUntil: '2020-01-01T00:00:00Z' },
        new Date('2026-01-01'),
      ),
    ).toBe(false)
  })
})
