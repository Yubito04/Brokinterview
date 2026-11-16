const STORAGE_KEY = 'applyflow.lang'

// localStorage can throw (blocked site data, private window): the app must still
// work, it just cannot remember the choice.
export function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeLanguage(language: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Not remembered: nothing else to do.
  }
}
