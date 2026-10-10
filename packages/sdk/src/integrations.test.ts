import { describe, expect, it } from 'vitest'
import { ingestUrl } from './integrations.ts'

describe('ingestUrl', () => {
  it('points to the sales-ingest Edge Function', () => {
    expect(ingestUrl('https://abc.supabase.co/')).toBe(
      'https://abc.supabase.co/functions/v1/sales-ingest',
    )
  })
})
