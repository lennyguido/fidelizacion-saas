// Datos de prueba. Las claves se generan en cada corrida: no hay credenciales reales.
import type { PassData } from '../lib/passData.ts'
import type { Rpc } from '../lib/db.ts'

export function passData(overrides: Partial<PassData> = {}): PassData {
  return {
    passId: '11111111-1111-1111-1111-111111111111',
    provider: 'google',
    objectId: 'abcdef0123456789abcdef0123456789',
    businessId: '22222222-2222-2222-2222-222222222222',
    updatedAt: '2026-10-10T12:00:00.000Z',
    active: true,
    business: { name: 'Café Central', primaryColor: '#ff8800', logoPath: 'biz/logo-1.png' },
    firstName: 'Rosa',
    memberCode: 'ABCD2345',
    pointsBalance: 7,
    unit: 'puntos',
    programKind: 'points',
    stampGoal: null,
    nextReward: { name: 'Café gratis', costPoints: 10 },
    rewardsAvailable: 0,
    ...overrides,
  }
}

function toPem(der: ArrayBuffer, label: string): string {
  let binary = ''
  for (const b of new Uint8Array(der)) binary += String.fromCharCode(b)
  const lines = btoa(binary).match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

export async function rsaKeyPair(): Promise<{ privateKeyPem: string; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  return { privateKeyPem: toPem(pkcs8, 'PRIVATE KEY'), publicKey: pair.publicKey }
}

export const FAKE_PEM = (label: string) => `-----BEGIN ${label}-----\nAAAA\n-----END ${label}-----`

export const BASE_ENV = {
  SUPABASE_URL: 'https://demo-ref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
}

export async function googleEnv(): Promise<{ env: Record<string, string>; publicKey: CryptoKey }> {
  const { privateKeyPem, publicKey } = await rsaKeyPair()
  return {
    publicKey,
    env: {
      ...BASE_ENV,
      GOOGLE_WALLET_ISSUER_ID: '3388000000012345678',
      GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'wallet@test-project.iam.gserviceaccount.com',
        private_key: privateKeyPem,
      }),
      WALLET_SYNC_SECRET: 'sync-secret-for-tests',
    },
  }
}

export const APPLE_ENV = {
  ...BASE_ENV,
  APPLE_PASS_TYPE_ID: 'pass.com.example.test',
  APPLE_TEAM_ID: 'TEAMID1234',
  APPLE_PASS_CERT_PEM: FAKE_PEM('CERTIFICATE'),
  APPLE_PASS_KEY_PEM: FAKE_PEM('PRIVATE KEY'),
  APPLE_WWDR_PEM: FAKE_PEM('CERTIFICATE'),
  WALLET_SYNC_SECRET: 'sync-secret-for-tests',
}

/** Base de datos de mentira: responde según el nombre de la función. */
export function fakeRpc(
  handlers: Record<string, (args: Record<string, unknown>) => unknown>,
): Rpc & { calls: { fn: string; args: Record<string, unknown> }[] } {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const rpc = (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args })
    const handler = handlers[fn]
    if (!handler) throw new Error(`unexpected rpc ${fn}`)
    return Promise.resolve(handler(args))
  }
  return Object.assign(rpc, { calls })
}

export function decodeJwtPart(part: string): Record<string, unknown> {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}
