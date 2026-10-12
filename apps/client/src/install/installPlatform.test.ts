import { describe, expect, it } from 'vitest'
import { installPlatform, isIos } from './installPlatform.ts'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1'
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15'
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

describe('installPlatform', () => {
  it('explains the Share sheet on iPhone Safari', () => {
    expect(installPlatform(IPHONE_SAFARI)).toBe('ios-safari')
  })

  it('asks to open Safari from other iPhone browsers', () => {
    expect(installPlatform(IPHONE_CHROME)).toBe('ios-other')
    expect(installPlatform(IPHONE_FIREFOX)).toBe('ios-other')
  })

  it('detects iPad in desktop mode by its touch screen', () => {
    expect(isIos(IPAD_DESKTOP_MODE, 5)).toBe(true)
    expect(isIos(IPAD_DESKTOP_MODE, 0)).toBe(false)
    expect(installPlatform(IPAD_DESKTOP_MODE, { maxTouchPoints: 5 })).toBe('ios-safari')
  })

  it('uses the browser prompt on Android only when it fired', () => {
    expect(installPlatform(ANDROID_CHROME, { hasPrompt: true })).toBe('prompt')
    expect(installPlatform(ANDROID_CHROME)).toBe('none')
  })
})
