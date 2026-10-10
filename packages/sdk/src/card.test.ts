import { describe, expect, it } from 'vitest'
import {
  MAX_STAMP_SLOTS,
  cardUrl,
  nextReward,
  showsStamps,
  stampSlots,
  tokenFromHash,
} from './card.ts'

const token = 'a'.repeat(64)

describe('tokenFromHash', () => {
  it('reads the token after #', () => {
    expect(tokenFromHash(`#${token}`)).toBe(token)
    expect(tokenFromHash(`#t=${token.toUpperCase()}`)).toBe(token)
  })
  it('rejects anything else', () => {
    expect(tokenFromHash('')).toBeNull()
    expect(tokenFromHash('#abc')).toBeNull()
  })
})

describe('cardUrl', () => {
  it('builds the link with the token in the fragment', () => {
    expect(cardUrl('https://club.app/', token)).toBe(`https://club.app/tarjeta#${token}`)
  })
})

describe('nextReward', () => {
  const rewards = [
    { id: '1', name: 'A', description: null, costPoints: 5 },
    { id: '2', name: 'B', description: null, costPoints: 10 },
  ]
  it('returns the first reward not yet reached', () => {
    expect(nextReward({ pointsBalance: 6, rewards })?.id).toBe('2')
    expect(nextReward({ pointsBalance: 12, rewards })).toBeNull()
  })
})

describe('stampSlots', () => {
  const reward = (id: string, costPoints: number) => ({
    id,
    name: `R${id}`,
    description: null,
    costPoints,
  })

  it('returns null without rewards', () => {
    expect(stampSlots(3, [])).toBeNull()
    expect(stampSlots(3, [reward('x', 0)])).toBeNull()
  })

  it('starts empty with balance 0', () => {
    expect(stampSlots(0, [reward('1', 6)])).toMatchObject({
      total: 6,
      filled: 0,
      goal: 6,
      progress: 0,
      missing: 6,
      readyCount: 0,
    })
  })

  it('fills one slot per point toward the next reward', () => {
    const slots = stampSlots(3, [reward('1', 6)])
    expect(slots).toMatchObject({ total: 6, filled: 3, missing: 3 })
    expect(slots?.reward.id).toBe('1')
  })

  it('shows a full card when every reward is reached', () => {
    expect(stampSlots(6, [reward('1', 6)])).toMatchObject({
      total: 6,
      filled: 6,
      missing: 0,
      readyCount: 1,
    })
    const slots = stampSlots(15, [reward('2', 10), reward('1', 6)])
    expect(slots).toMatchObject({ total: 6, filled: 6, goal: 6, missing: 0, readyCount: 2 })
    expect(slots?.reward.id).toBe('1')
  })

  it('points to the next reward when there are several (in any order)', () => {
    const slots = stampSlots(8, [reward('2', 10), reward('1', 6)])
    expect(slots).toMatchObject({ total: 10, filled: 8, goal: 10, missing: 2, readyCount: 1 })
    expect(slots?.reward.id).toBe('2')
  })

  it('caps the slots at 20 and fills them in proportion', () => {
    expect(stampSlots(15, [reward('1', 30)])).toMatchObject({
      total: MAX_STAMP_SLOTS,
      filled: 10,
      goal: 30,
      progress: 15,
      missing: 15,
    })
    expect(stampSlots(29, [reward('1', 30)])?.filled).toBe(19)
    expect(stampSlots(30, [reward('1', 30)])?.filled).toBe(20)
  })

  it('ignores negative or fractional balances', () => {
    expect(stampSlots(-4, [reward('1', 5)])?.filled).toBe(0)
    expect(stampSlots(2.7, [reward('1', 5)])?.filled).toBe(2)
  })
})

describe('showsStamps', () => {
  const slots = (goal: number) =>
    stampSlots(0, [{ id: '1', name: 'R', description: null, costPoints: goal }])
  it('always for stamp programs with rewards', () => {
    expect(showsStamps('stamps', slots(50))).toBe(true)
    expect(showsStamps('stamps', null)).toBe(false)
  })
  it('for points programs only with small rewards', () => {
    expect(showsStamps('points', slots(20))).toBe(true)
    expect(showsStamps('points', slots(21))).toBe(false)
  })
})
