import { describe, expect, it } from 'vitest'
import { clientAppUrl, whatsappLink } from './clientAppUrl'

const loc = (href: string) => new URL(href) as unknown as Location

describe('clientAppUrl', () => {
  it('uses the configured URL', () => {
    expect(clientAppUrl({ VITE_CLIENT_APP_URL: 'https://club.app/' }, loc('http://x:5173'))).toBe(
      'https://club.app',
    )
  })
  it('switches the Codespaces port to 5174', () => {
    expect(clientAppUrl({}, loc('https://my-space-5173.app.github.dev/b/x'))).toBe(
      'https://my-space-5174.app.github.dev',
    )
  })
  it('uses port 5174 locally', () => {
    expect(clientAppUrl({}, loc('http://localhost:5173/'))).toBe('http://localhost:5174')
  })
})

describe('whatsappLink', () => {
  it('builds a wa.me link with digits only', () => {
    expect(whatsappLink('+5491122334455', 'Hola!')).toBe('https://wa.me/5491122334455?text=Hola!')
  })
})
