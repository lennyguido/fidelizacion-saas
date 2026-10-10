import { describe, expect, it } from 'vitest'
import {
  WalletError,
  isWalletRedirect,
  parseWalletStatus,
  walletErrorCode,
  walletErrorMessage,
} from './wallet.ts'

describe('parseWalletStatus', () => {
  it('reads the flags', () => {
    expect(parseWalletStatus({ google: true, apple: false })).toEqual({
      google: true,
      apple: false,
    })
  })
  it('shows nothing when the answer is unexpected', () => {
    expect(parseWalletStatus(null)).toEqual({ google: false, apple: false })
    expect(parseWalletStatus({ google: 'yes' })).toEqual({ google: false, apple: false })
  })
})

describe('walletErrorCode', () => {
  it('uses the error code from the function', () => {
    expect(walletErrorCode(422, { error: 'logo_required' })).toBe('logo_required')
    expect(walletErrorCode(400, { error: 'invalid_token' })).toBe('card_not_found')
    expect(walletErrorCode(502, { error: 'provider_error' })).toBe('provider_error')
  })
  it('falls back to the HTTP status', () => {
    expect(walletErrorCode(501, null)).toBe('not_configured')
    expect(walletErrorCode(404, null)).toBe('card_not_found')
    expect(walletErrorCode(null, null)).toBe('network')
    expect(walletErrorCode(500, { error: 'server_error' })).toBe('unknown')
  })
})

describe('walletErrorMessage', () => {
  it('speaks Spanish', () => {
    expect(walletErrorMessage(new WalletError('logo_required'))).toMatch(/logo/)
    expect(walletErrorMessage(new Error('x'))).toMatch(/No se pudo agregar/)
  })
})

describe('isWalletRedirect', () => {
  it('only allows the official Google save page', () => {
    expect(isWalletRedirect('google', 'https://pay.google.com/gp/v/save/abc.def.ghi')).toBe(true)
    expect(isWalletRedirect('google', 'https://evil.example/gp/v/save/abc')).toBe(false)
    expect(isWalletRedirect('google', 'http://pay.google.com/gp/v/save/abc')).toBe(false)
    expect(isWalletRedirect('google', 'javascript:alert(1)')).toBe(false)
  })
  it('only allows the Apple pass download of the function', () => {
    expect(
      isWalletRedirect(
        'apple',
        'https://ref.supabase.co/functions/v1/wallet/apple/download/abc?auth=x',
      ),
    ).toBe(true)
    expect(isWalletRedirect('apple', 'https://ref.supabase.co/other')).toBe(false)
  })
})
