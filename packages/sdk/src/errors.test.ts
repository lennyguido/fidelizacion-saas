import { describe, expect, it } from 'vitest'
import { AppError, errorMessage, fromAuthError, fromPostgrestError } from './errors.ts'

describe('fromPostgrestError', () => {
  it.each([
    [{ code: '42501', message: 'not a member' }, 'forbidden'],
    [{ code: '23505', message: 'slug_taken' }, 'slug_taken'],
    [{ code: '23505', message: 'duplicate_visit: ...' }, 'duplicate_visit'],
    [{ code: '23505', message: 'duplicate key' }, 'conflict'],
    [{ code: '22023', message: 'invalid' }, 'invalid'],
    [{ code: 'P0002', message: 'not found' }, 'not_found'],
    [{ code: '54000', message: 'limit' }, 'limit_reached'],
    [{ code: 'XX000', message: 'boom' }, 'unknown'],
  ])('%j → %s', (error, code) => {
    expect(fromPostgrestError(error).code).toBe(code)
  })
})

describe('fromAuthError', () => {
  it.each([
    [{ code: 'invalid_credentials' }, 'auth_invalid_credentials'],
    [{ code: 'email_not_confirmed' }, 'auth_email_not_confirmed'],
    [{ code: 'user_already_exists' }, 'auth_user_exists'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'rate_limited'],
    [{ code: 'something_new', status: 429 }, 'rate_limited'],
    [{ code: 'email_address_invalid' }, 'auth_invalid_email'],
  ])('%j → %s', (error, code) => {
    expect(fromAuthError(error).code).toBe(code)
  })
})

describe('errorMessage', () => {
  it('gives a Spanish message for known errors', () => {
    expect(errorMessage(new AppError('rate_limited', 'x'))).toContain('Esperá unos minutos')
  })
  it('falls back for unknown values', () => {
    expect(errorMessage(new Error('x'))).toBe('Ocurrió un error inesperado. Probá de nuevo.')
  })
})
