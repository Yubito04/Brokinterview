import { createInstance, type i18n, type Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { readStoredLanguage, storeLanguage } from './languageStorage'
import { initialLanguage, type Language } from './languages'

// One translator per call (like createQueryClient): tests build their own.
// `language` is only given by tests; the app lets the stored choice and the browser decide.
export function createI18n(
  resources: Resource,
  language: Language = initialLanguage(readStoredLanguage(), navigator.languages),
): i18n {
  const instance = createInstance()
  // Keeps the page's <html lang> equal to the displayed language: screen readers
  // use it to choose the pronunciation. Fires at start and at every change.
  instance.on('languageChanged', (current) => {
    document.documentElement.lang = current
  })
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: false,
    // false = the dictionaries are already in memory, so init finishes at once
    // (no loading step to wait for before the first render).
    initAsync: false,
    // React already escapes what it displays; escaping twice would show "&amp;".
    interpolation: { escapeValue: false },
  })
  return instance
}

// The user's explicit choice: remembered for next time, then applied.
// Starting up does NOT store anything, so a browser whose language changes keeps being followed
// until the user picks a language themselves.
export function setLanguage(instance: i18n, language: Language): Promise<unknown> {
  storeLanguage(language)
  return instance.changeLanguage(language)
}
