import { afterEach, describe, expect, it, vi } from 'vitest'
import openapiText from '../../../backend/openapi.json?raw'
import { EXTRACTION_TIMEOUT_MS, createApiClient } from './client'
import { ApiError } from './errors'
import { MAX_POSTING_LENGTH, extractJobPosting } from './jobPostings'

const FOUND = {
  company: 'Acme',
  position: 'Backend Developer',
  location: null,
  deadline: '2026-12-15',
  skills: ['Python', 'PostgreSQL'],
}

function clientAnswering(status: number, body: unknown) {
  const fetchFn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  return { client: createApiClient({ baseUrl: 'http://api.test', fetchFn }), fetchFn }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('extractJobPosting', () => {
  it('posts the text as JSON and returns what was found, nulls included', async () => {
    const { client, fetchFn } = clientAnswering(200, FOUND)

    const result = await extractJobPosting(client, 'Acme is hiring')

    expect(result).toEqual(FOUND)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(new URL(url).pathname).toBe('/job-postings/extract')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ text: 'Acme is hiring' })
  })

  it('sends the text as it is: no trimming, the server decides what is blank', async () => {
    const { client, fetchFn } = clientAnswering(200, FOUND)
    await extractJobPosting(client, '  text with spaces \n')
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ text: '  text with spaces \n' })
  })

  it('mirrors the size limit declared in the API contract (backend/openapi.json)', () => {
    const spec = JSON.parse(openapiText) as {
      components: { schemas: { JobPostingText: { properties: { text: { maxLength: number } } } } }
    }
    expect(MAX_POSTING_LENGTH).toBe(spec.components.schemas.JobPostingText.properties.text.maxLength)
  })

  it('waits up to 60 seconds, not the default 10', async () => {
    vi.useFakeTimers()
    // A server that never answers: fetch only ends when it is told to give up.
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn })

    const outcome = extractJobPosting(client, 'text').catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS - 1)
    const stillWaiting = await Promise.race([outcome, Promise.resolve('waiting')])
    expect(stillWaiting).toBe('waiting')

    await vi.advanceTimersByTimeAsync(1)
    const error = (await outcome) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.kind).toBe('timeout')
    expect(error.params).toEqual({ seconds: 60 })
  })

  it('stops waiting when the user cancels, without making a failure of it', async () => {
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn })
    const controller = new AbortController()

    const outcome = extractJobPosting(client, 'text', controller.signal).catch((error: unknown) => error)
    controller.abort()

    const error = await outcome
    // The cancel passes through as it is: it is not an ApiError to show to the user.
    expect(error).not.toBeInstanceOf(ApiError)
    expect((error as Error).name).toBe('AbortError')
  })

  it.each([
    [502, 'upstream'],
    [503, 'unavailable'],
    [504, 'upstream_timeout'],
  ])('maps the %i answer of the AI service to the kind %s', async (status, kind) => {
    const { client } = clientAnswering(status, { detail: 'x' })
    const error = await extractJobPosting(client, 'text').catch((caught: unknown) => caught)
    expect((error as ApiError).kind).toBe(kind)
  })

  it('reports a text refused by the API (422) by field', async () => {
    const detail = [{ type: 'value_error', loc: ['body', 'text'], msg: 'Value error, text cannot be empty', ctx: {} }]
    const { client } = clientAnswering(422, { detail })
    const error = await extractJobPosting(client, '   ').catch((caught: unknown) => caught)
    expect((error as ApiError).fieldErrors.text).toMatchObject({ type: 'value_error' })
  })
})
