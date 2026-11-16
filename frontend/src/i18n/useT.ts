import { useTranslation } from 'react-i18next'
import type { fr } from './fr'

// All the paths of a dictionary: { a: { b: 'x' }, c: 'y' } -> 'a.b' | 'c'.
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`
}[keyof T & string]

// Every key the screens may ask for: derived from the French dictionary, so a typo
// (t('pagination.nxt')) or a key that was removed is a compile error, not a blank
// label discovered in the browser.
export type MessageKey = Paths<typeof fr>

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string

// The hook screens use instead of react-i18next's own `t`. It also re-renders the
// screen when the language changes.
export function useT(): Translate {
  const { t } = useTranslation()
  return (key, values) => t(key, values)
}
