import { MAX_POSTING_LENGTH } from '../api/jobPostings'

// How the server counts: in characters (code points), not in the UTF-16 units that
// `text.length` counts. An emoji is 1 for the server and 2 for `.length`: with `.length`
// the counter would say "too long" for a text the server accepts.
export function countCharacters(text: string): number {
  return Array.from(text).length
}

export function isTooLong(text: string): boolean {
  return countCharacters(text) > MAX_POSTING_LENGTH
}
