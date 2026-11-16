import { describe, expect, it } from 'vitest'
import { FALLBACK_LANGUAGE, initialLanguage, isLanguage } from './languages'

describe('isLanguage', () => {
  it('accepts only the supported languages', () => {
    expect(isLanguage('fr')).toBe(true)
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('de')).toBe(false)
    expect(isLanguage('FR')).toBe(false)
    expect(isLanguage(null)).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })
})

describe('initialLanguage', () => {
  it('uses English as the fallback language', () => {
    expect(FALLBACK_LANGUAGE).toBe('en')
  })

  it('prefers the stored choice over the browser', () => {
    expect(initialLanguage('fr', ['en-US'])).toBe('fr')
    expect(initialLanguage('en', ['fr-CA'])).toBe('en')
  })

  it.each([
    ['not a language', 'de'],
    ['wrong case', 'FR'],
    ['empty', ''],
    ['garbage', '<script>'],
  ])('ignores a stored value that is %s', (_label, stored) => {
    expect(initialLanguage(stored, ['fr-CA'])).toBe('fr')
  })

  it.each([
    ['French with a region', ['fr-CA'], 'fr'],
    ['plain French', ['fr'], 'fr'],
    ['upper case tag', ['FR-fr'], 'fr'],
    ['English with a region', ['en-GB'], 'en'],
    ['first supported one wins', ['de-DE', 'fr-FR', 'en-US'], 'fr'],
    ['skips unsupported ones', ['es', 'it', 'en'], 'en'],
  ])('follows the browser: %s', (_label, browser, expected) => {
    expect(initialLanguage(null, browser)).toBe(expected)
  })

  it.each([
    ['only unsupported languages', ['de-DE', 'es']],
    ['an empty list', []],
    ['an empty tag', ['']],
    ['a language that only starts like a supported one', ['fra', 'eng']],
  ])('falls back to English with %s', (_label, browser) => {
    expect(initialLanguage(null, browser)).toBe('en')
  })
})
