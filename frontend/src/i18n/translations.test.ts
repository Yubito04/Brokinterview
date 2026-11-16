import { describe, expect, it } from 'vitest'
import { compareDictionaries, flatten, placeholders, type Dictionary } from './dictionaryParity'
import { en } from './en'
import { fr } from './fr'

// The guard that matters: the French and English dictionaries have exactly the
// same keys and the same {{variables}}. When it fails, the message lists what differs.
describe('French and English dictionaries', () => {
  const report = compareDictionaries(fr, en)

  it('have exactly the same keys', () => {
    expect({
      'only in French': report.missingInSecond,
      'only in English': report.missingInFirst,
    }).toEqual({ 'only in French': [], 'only in English': [] })
  })

  it('use the same {{variables}} in every text', () => {
    expect(report.differentPlaceholders).toEqual([])
  })

  it('have no empty text', () => {
    expect(report.emptyTexts).toEqual([])
  })
})

// The checker itself must notice problems, otherwise the test above proves nothing.
describe('compareDictionaries', () => {
  const base: Dictionary = { a: { b: 'x', c: 'Hello {{name}}' }, d: 'y' }

  it('finds nothing between identical shapes', () => {
    const other: Dictionary = { a: { b: 'z', c: 'Bonjour {{name}}' }, d: 'w' }
    expect(compareDictionaries(base, other)).toEqual({
      missingInSecond: [],
      missingInFirst: [],
      differentPlaceholders: [],
      emptyTexts: [],
    })
  })

  it('finds a key missing on either side, at any depth', () => {
    const other: Dictionary = { a: { b: 'z', c: 'Bonjour {{name}}', e: 'extra' } }
    const report = compareDictionaries(base, other)
    expect(report.missingInSecond).toEqual(['d'])
    expect(report.missingInFirst).toEqual(['a.e'])
  })

  it('finds a variable that is missing, renamed or added', () => {
    const other: Dictionary = { a: { b: 'z {{oops}}', c: 'Bonjour' }, d: 'w' }
    expect(compareDictionaries(base, other).differentPlaceholders).toEqual(['a.b', 'a.c'])
  })

  it('finds empty texts, including blank ones', () => {
    const other: Dictionary = { a: { b: '', c: 'Bonjour {{name}}' }, d: '   ' }
    expect(compareDictionaries(base, other).emptyTexts).toEqual(['a.b', 'd'])
  })

  it('does not fail on plural forms that one language does not have', () => {
    // French has one/many/other, English only one/other.
    const french: Dictionary = {
      n_one: '{{count}} élément',
      n_many: '{{count}} d’éléments',
      n_other: '{{count}} éléments',
    }
    const english: Dictionary = { n_one: '{{count}} item', n_other: '{{count}} items' }
    const report = compareDictionaries(french, english)
    expect(report.missingInFirst).toEqual([])
    expect(report.missingInSecond).toEqual([])
    expect(report.differentPlaceholders).toEqual([])
  })

  it('still finds a missing plural key altogether', () => {
    const report = compareDictionaries({ n_one: '1', n_other: '2' }, {})
    expect(report.missingInSecond).toEqual(['n'])
  })
})

describe('helpers', () => {
  it('flatten joins nested keys with dots', () => {
    expect(flatten({ a: { b: { c: 'x' } }, d: 'y' })).toEqual({ 'a.b.c': 'x', d: 'y' })
  })

  it('placeholders lists each variable once, ignoring spaces inside the braces', () => {
    expect(placeholders('{{b}} and {{ a }} and {{b}}')).toEqual(['a', 'b'])
    expect(placeholders('no variable')).toEqual([])
  })
})
