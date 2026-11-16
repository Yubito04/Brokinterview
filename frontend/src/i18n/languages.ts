export const LANGUAGES = ['fr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

// Used when nothing is stored and the browser speaks neither French nor English.
export const FALLBACK_LANGUAGE: Language = 'en'

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value)
}

// Picks the language to start in. Pure on purpose: the browser's answers are passed
// in, so every case can be tested without a browser.
//   1. the user's earlier choice (from localStorage), if it is a known language;
//   2. else the first browser language we support ("fr-CA" -> "fr", "EN" -> "en");
//   3. else the fallback.
export function initialLanguage(
  stored: string | null,
  browserLanguages: readonly string[],
): Language {
  if (isLanguage(stored)) return stored
  for (const tag of browserLanguages) {
    // A tag looks like "fr-CA": language first, then region. Only the language matters.
    const primary = tag.toLowerCase().split('-')[0]
    if (isLanguage(primary)) return primary
  }
  return FALLBACK_LANGUAGE
}
