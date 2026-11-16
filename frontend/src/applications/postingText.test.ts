import { describe, expect, it } from 'vitest'
import { MAX_POSTING_LENGTH } from '../api/jobPostings'
import { countCharacters, isTooLong } from './postingText'

describe('countCharacters', () => {
  it('counts plain text by its length', () => {
    expect(countCharacters('')).toBe(0)
    expect(countCharacters('Acme')).toBe(4)
  })

  it('counts an emoji or a rare character once, like the server, not twice like .length', () => {
    expect('😀'.length).toBe(2)
    expect(countCharacters('😀')).toBe(1)
    expect(countCharacters('a😀b')).toBe(3)
  })

  it('counts accents and line breaks as one character each', () => {
    expect(countCharacters('é\n\u00e8')).toBe(3)
  })
})

describe('isTooLong', () => {
  it('accepts exactly the limit and refuses one more', () => {
    expect(isTooLong('x'.repeat(MAX_POSTING_LENGTH))).toBe(false)
    expect(isTooLong('x'.repeat(MAX_POSTING_LENGTH + 1))).toBe(true)
  })

  it('does not call a text too long because its emojis count twice in .length', () => {
    // 15,000 emojis: 30,000 for .length, 15,000 for the server.
    expect(isTooLong('😀'.repeat(15_000))).toBe(false)
  })
})
