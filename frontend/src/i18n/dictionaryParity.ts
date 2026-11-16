// Checks that two dictionaries say the same things in the same places.
// Used by the tests; kept here (not inside the test file) so that the checker
// itself can be tested.

export type Dictionary = { [key: string]: string | Dictionary }

// {"a": {"b": "x"}} -> {"a.b": "x"}
export function flatten(dictionary: Dictionary, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {}
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') flat[path] = value
    else Object.assign(flat, flatten(value, path))
  }
  return flat
}

// i18next stores plurals as several keys ("item_one", "item_other"), and languages
// do not have the same plural categories (French has "many", English does not).
// Plural suffixes are removed so that "item" is compared, not its forms.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function baseKey(key: string): string {
  return key.replace(PLURAL_SUFFIX, '')
}

// "{{count}} items on page {{ page }}" -> ["count", "page"]
export function placeholders(text: string): string[] {
  const names = [...text.matchAll(/\{\{\s*([\w.]+)/g)].map((match) => match[1])
  return [...new Set(names)].sort()
}

// Plural forms of one key may use different variables; compare the union.
function placeholdersByBaseKey(flat: Record<string, string>): Record<string, string[]> {
  const byKey: Record<string, Set<string>> = {}
  for (const [key, text] of Object.entries(flat)) {
    const base = baseKey(key)
    byKey[base] ??= new Set()
    for (const name of placeholders(text)) byKey[base].add(name)
  }
  return Object.fromEntries(
    Object.entries(byKey).map(([key, names]) => [key, [...names].sort()]),
  )
}

export type ParityReport = {
  missingInSecond: string[] // in the first dictionary only
  missingInFirst: string[] // in the second dictionary only
  differentPlaceholders: string[] // same key, different {{variables}}
  emptyTexts: string[] // keys whose text is blank, in either dictionary
}

export function compareDictionaries(first: Dictionary, second: Dictionary): ParityReport {
  const firstFlat = flatten(first)
  const secondFlat = flatten(second)
  const firstPlaceholders = placeholdersByBaseKey(firstFlat)
  const secondPlaceholders = placeholdersByBaseKey(secondFlat)
  const firstKeys = Object.keys(firstPlaceholders)
  const secondKeys = Object.keys(secondPlaceholders)

  return {
    missingInSecond: firstKeys.filter((key) => !(key in secondPlaceholders)).sort(),
    missingInFirst: secondKeys.filter((key) => !(key in firstPlaceholders)).sort(),
    differentPlaceholders: firstKeys
      .filter(
        (key) =>
          key in secondPlaceholders &&
          firstPlaceholders[key].join() !== secondPlaceholders[key].join(),
      )
      .sort(),
    emptyTexts: [
      ...Object.entries(firstFlat).filter(([, text]) => text.trim() === ''),
      ...Object.entries(secondFlat).filter(([, text]) => text.trim() === ''),
    ]
      .map(([key]) => key)
      .sort(),
  }
}
