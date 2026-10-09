import { describe, expect, it } from 'vitest'
import {
  LOGO_MAX_BYTES,
  isValidHexColor,
  logoFileError,
  logoObjectPath,
  normalizeHexColor,
  textColorOn,
} from './branding.ts'

describe('isValidHexColor', () => {
  it('accepts #rrggbb only', () => {
    expect(isValidHexColor('#0f172a')).toBe(true)
    expect(isValidHexColor('#ABCDEF')).toBe(true)
    expect(isValidHexColor('0f172a')).toBe(false)
    expect(isValidHexColor('#fff')).toBe(false)
    expect(isValidHexColor('#0f172g')).toBe(false)
    expect(isValidHexColor('#0f172a ')).toBe(false)
  })
})

describe('normalizeHexColor', () => {
  it('adds the hash, trims and lowercases', () => {
    expect(normalizeHexColor(' ABC123 ')).toBe('#abc123')
    expect(normalizeHexColor('#D97706')).toBe('#d97706')
  })
  it('rejects invalid colors', () => {
    expect(normalizeHexColor('rojo')).toBeNull()
    expect(normalizeHexColor('#12345')).toBeNull()
    expect(normalizeHexColor('')).toBeNull()
  })
})

describe('textColorOn', () => {
  it('uses white on dark colors and dark text on light colors', () => {
    expect(textColorOn('#0f172a')).toBe('#ffffff')
    expect(textColorOn('#1d4ed8')).toBe('#ffffff')
    expect(textColorOn('#ffffff')).toBe('#0f172a')
    expect(textColorOn('#facc15')).toBe('#0f172a')
  })
})

describe('logoFileError', () => {
  it('accepts allowed images up to 1 MB', () => {
    expect(logoFileError({ type: 'image/png', size: 2000 })).toBeNull()
    expect(logoFileError({ type: 'image/svg+xml', size: LOGO_MAX_BYTES })).toBeNull()
  })
  it('rejects other types, empty and big files', () => {
    expect(logoFileError({ type: 'image/gif', size: 10 })).toMatch(/PNG, JPG/)
    expect(logoFileError({ type: 'application/pdf', size: 10 })).toMatch(/PNG, JPG/)
    expect(logoFileError({ type: 'image/jpeg', size: 0 })).toMatch(/vacío/)
    expect(logoFileError({ type: 'image/webp', size: LOGO_MAX_BYTES + 1 })).toMatch(/1 MB/)
  })
})

describe('logoObjectPath', () => {
  it('puts the file inside the business folder', () => {
    expect(logoObjectPath('b1', 'image/jpeg', 1700000000000)).toBe('b1/logo-1700000000000.jpg')
    expect(logoObjectPath('b1', 'image/svg+xml', 5)).toBe('b1/logo-5.svg')
  })
  it('refuses unknown types', () => {
    expect(() => logoObjectPath('b1', 'image/gif', 5)).toThrow()
  })
})
