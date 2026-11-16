import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDeadline } from './formatDeadline'

// Intl puts a no-break space (U+00A0 / U+202F) in some locales: normalise before comparing.
const plain = (text: string) => text.replace(/[  ]/g, ' ')

describe('formatDeadline', () => {
  // West of Greenwich, midnight UTC is still the evening of the day before.
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('formats in French', () => {
    expect(plain(formatDeadline('2026-11-20', 'fr'))).toBe('20 nov. 2026')
  })

  it('formats in English', () => {
    expect(plain(formatDeadline('2026-11-20', 'en'))).toBe('Nov 20, 2026')
  })

  it('shows a dash when there is no date', () => {
    expect(formatDeadline(null, 'fr')).toBe('—')
  })

  it('keeps the day at the edges of the year, in a timezone west of Greenwich', () => {
    expect(plain(formatDeadline('2026-01-01', 'en'))).toBe('Jan 1, 2026')
    expect(plain(formatDeadline('2026-12-31', 'en'))).toBe('Dec 31, 2026')
  })

  it('shows text that is not a real date as it came', () => {
    expect(formatDeadline('abc', 'fr')).toBe('abc')
    expect(formatDeadline('2026-02-31', 'fr')).toBe('2026-02-31')
  })
})
