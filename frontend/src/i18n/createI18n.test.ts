import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n, setLanguage } from './createI18n'
import { readStoredLanguage, storeLanguage } from './languageStorage'

const RESOURCES = {
  fr: { translation: { hello: 'Bonjour', count: '{{count}} éléments' } },
  en: { translation: { hello: 'Hello', count: '{{count}} items' } },
}

function browserSpeaks(...languages: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages)
}

afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.lang = ''
})

describe('language storage', () => {
  it('remembers a language', () => {
    storeLanguage('fr')
    expect(readStoredLanguage()).toBe('fr')
  })

  it('answers null when nothing is stored', () => {
    expect(readStoredLanguage()).toBeNull()
  })

  it('survives a localStorage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredLanguage()).toBeNull()
    expect(() => storeLanguage('fr')).not.toThrow()
  })
})

describe('createI18n', () => {
  it('starts in the browser language', () => {
    browserSpeaks('fr-CA', 'en')
    const i18n = createI18n(RESOURCES)
    expect(i18n.language).toBe('fr')
    expect(i18n.t('hello')).toBe('Bonjour')
  })

  it('starts in the stored language, even against the browser', () => {
    browserSpeaks('fr-CA')
    storeLanguage('en')
    expect(createI18n(RESOURCES).t('hello')).toBe('Hello')
  })

  it('falls back to English for an unsupported browser', () => {
    browserSpeaks('de-DE')
    expect(createI18n(RESOURCES).t('hello')).toBe('Hello')
  })

  it('does not store the detected language (only an explicit choice is stored)', () => {
    browserSpeaks('fr-CA')
    createI18n(RESOURCES)
    expect(readStoredLanguage()).toBeNull()
  })

  it('sets <html lang> from the start', () => {
    createI18n(RESOURCES, 'fr')
    expect(document.documentElement.lang).toBe('fr')
  })

  it('fills in variables', () => {
    expect(createI18n(RESOURCES, 'en').t('count', { count: 3 })).toBe('3 items')
    expect(createI18n(RESOURCES, 'fr').t('count', { count: 3 })).toBe('3 éléments')
  })

  it('shows the key itself for a missing translation (no silent fallback to another language)', () => {
    expect(createI18n(RESOURCES, 'fr').t('missing.key')).toBe('missing.key')
  })
})

describe('setLanguage', () => {
  it('switches the language, stores the choice and updates <html lang>', async () => {
    const i18n = createI18n(RESOURCES, 'fr')

    await setLanguage(i18n, 'en')

    expect(i18n.t('hello')).toBe('Hello')
    expect(readStoredLanguage()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('is remembered by the next start', async () => {
    browserSpeaks('fr-CA')
    await setLanguage(createI18n(RESOURCES), 'en')

    expect(createI18n(RESOURCES).language).toBe('en')
  })
})
