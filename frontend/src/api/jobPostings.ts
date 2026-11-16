import type { ApiClient } from './client'
import { EXTRACTION_TIMEOUT_MS } from './client'
import type { components } from './schema'

// What the AI found in a posting. Every field but `skills` can be null: "not in the text"
// is a valid answer. `skills` is never null (an empty list when there is none).
export type ExtractedJob = components['schemas']['ExtractedJob']

// The same limit as the API (MAX_POSTING_LENGTH in the backend), used to limit typing and
// to show a counter. It is not a validation: the server answers 422 past it.
export const MAX_POSTING_LENGTH = 20_000

// Sends the text of a job posting to the AI and returns what it found. NOTHING is saved
// by this call: the screen shows the result for review before creating the application.
//
// Unlike the other writes it takes a `signal`: it changes nothing in our data, so giving
// up on it is safe. (The server may still finish and pay for the call: cancelling only
// stops WAITING.) It is never retried by the client either: every attempt costs money.
export function extractJobPosting(
  client: ApiClient,
  text: string,
  signal?: AbortSignal,
): Promise<ExtractedJob> {
  return client.request<ExtractedJob>('/job-postings/extract', {
    method: 'POST',
    body: { text },
    // The model has to read and answer: 60 s instead of the default 10 s.
    timeoutMs: EXTRACTION_TIMEOUT_MS,
    signal,
  })
}
