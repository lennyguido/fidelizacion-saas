import { describe, expect, it } from 'vitest'
import { codeFromPath, signupPath } from './selfSignup.ts'

describe('signup path', () => {
  it('round-trips the poster code', () => {
    expect(codeFromPath(signupPath('ABCDEFGH23'))).toBe('ABCDEFGH23')
  })
  it('rejects other paths', () => {
    expect(codeFromPath('/')).toBeNull()
    expect(codeFromPath('/alta/short')).toBeNull()
    expect(codeFromPath('/alta/ABCDEFGH23/otra')).toBeNull()
  })
})
