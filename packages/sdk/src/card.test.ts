import { describe, expect, it } from 'vitest'
import { cardUrl, nextReward, tokenFromHash } from './card.ts'

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
