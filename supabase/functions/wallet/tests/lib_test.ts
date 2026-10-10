import assert from 'node:assert/strict'
import { readConfig, readPem, readServiceKey, walletStatus } from '../lib/config.ts'
import { safeEqual, corsHeaders } from '../lib/http.ts'
import { toPassData } from '../lib/passData.ts'
import { brandColor, hexToRgb, publicLogoUrl, rewardText, textColorOn } from '../lib/text.ts'
import { BASE_ENV, googleEnv, passData } from './helpers.ts'

Deno.test('rewardText explains what is missing for the next reward', () => {
  assert.equal(rewardText(passData()), 'Te faltan 3 puntos para "Café gratis".')
  assert.equal(
    rewardText(passData({ rewardsAvailable: 2 })),
    'Ya podés canjear 2 recompensas en la caja.',
  )
  assert.equal(rewardText(passData({ nextReward: null })), 'Sumás puntos en cada visita.')
  assert.equal(rewardText(passData({ active: false })), 'Esta tarjeta ya no está activa.')
})

Deno.test('brand colors fall back and convert for Apple', () => {
  assert.equal(brandColor(null), '#0f172a')
  assert.equal(brandColor('red'), '#0f172a')
  assert.equal(brandColor('#FF8800'), '#ff8800')
  assert.equal(hexToRgb('#ff8800'), 'rgb(255, 136, 0)')
  assert.equal(textColorOn('#ffffff'), '#0f172a')
  assert.equal(textColorOn('#0f172a'), '#ffffff')
})

Deno.test('publicLogoUrl points to the public logos bucket', () => {
  assert.equal(
    publicLogoUrl('https://x.supabase.co/', 'biz/logo 1.png'),
    'https://x.supabase.co/storage/v1/object/public/logos/biz/logo%201.png',
  )
  assert.equal(publicLogoUrl('https://x.supabase.co', null), null)
})

Deno.test('without secrets every wallet is off', () => {
  const config = readConfig({})
  assert.equal(config.google, null)
  assert.equal(config.apple, null)
  assert.deepEqual(walletStatus(config), { google: false, apple: false })
  assert.deepEqual(walletStatus(readConfig(BASE_ENV)), { google: false, apple: false })
})

Deno.test('Google is on with issuer id + service account JSON (raw or base64)', async () => {
  const { env } = await googleEnv()
  assert.deepEqual(walletStatus(readConfig(env)), { google: true, apple: false })
  const b64 = {
    ...env,
    GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: btoa(env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON),
  }
  assert.equal(readConfig(b64).google?.clientEmail, 'wallet@test-project.iam.gserviceaccount.com')
  assert.equal(readConfig({ ...env, GOOGLE_WALLET_ISSUER_ID: 'abc' }).google, null)
  assert.equal(readConfig({ ...env, GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: '{bad' }).google, null)
})

Deno.test('PEM secrets accept escaped newlines and base64', () => {
  const pem = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'
  assert.equal(readPem(pem.replace(/\n/g, '\\n')), pem)
  assert.equal(readPem(btoa(pem)), pem)
  assert.equal(readPem('not a pem'), null)
  assert.equal(readPem(undefined), null)
})

Deno.test('service key comes from the legacy key or the new secret keys', () => {
  assert.equal(readServiceKey({ SUPABASE_SERVICE_ROLE_KEY: 'legacy' }), 'legacy')
  assert.equal(readServiceKey({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_x"}' }), 'sb_secret_x')
  assert.equal(readServiceKey({}), null)
})

Deno.test('toPassData normalizes the database payload', () => {
  const data = toPassData({ ...passData(), pointsBalance: '12', firstName: '' })
  assert.equal(data?.pointsBalance, 12)
  assert.equal(data?.firstName, null)
  assert.equal(toPassData(null), null)
  assert.equal(toPassData({ nope: true }), null)
})

Deno.test('safeEqual and CORS', () => {
  assert.ok(safeEqual('abc', 'abc'))
  assert.ok(!safeEqual('abc', 'abd'))
  assert.ok(!safeEqual('abc', 'abcd'))
  assert.equal(corsHeaders('https://a.app', [])['Access-Control-Allow-Origin'], '*')
  assert.equal(
    corsHeaders('https://b.app', ['https://a.app', 'https://b.app'])['Access-Control-Allow-Origin'],
    'https://b.app',
  )
  assert.equal(
    corsHeaders('https://evil.app', ['https://a.app'])['Access-Control-Allow-Origin'],
    'https://a.app',
  )
})
