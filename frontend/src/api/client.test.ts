import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import { ApiError } from './errors'

const BASE = 'http://api.test'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function clientAnswering(response: Response) {
  const fetchFn = vi.fn().mockResolvedValue(response)
  return { client: createApiClient({ baseUrl: BASE, fetchFn }), fetchFn }
}

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    return error as ApiError
  }
  throw new Error('Expected the call to fail')
}

// A fake fetch that never answers, but stops like the real one when aborted.
function neverAnsweringFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError')),
      )
    })
  }) as unknown as typeof fetch
}

afterEach(() => {
  vi.useRealTimers()
})

describe('success', () => {
  it('returns the parsed JSON', async () => {
    const { client } = clientAnswering(jsonResponse(200, { status: 'ok' }))

    expect(await client.request('/health')).toEqual({ status: 'ok' })
  })

  it('sends the body as JSON and builds the query string without empty values', async () => {
    const { client, fetchFn } = clientAnswering(jsonResponse(200, {}))

    await client.request('/applications', {
      method: 'POST',
      body: { company: 'Acme' },
      query: { q: 'dev', status: '', limit: 20 },
    })

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(`${BASE}/applications?q=dev&limit=20`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"company":"Acme"}')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })
})

describe('422 validation errors', () => {
  it('turns each failing field into a field error', async () => {
    const { client } = clientAnswering(
      jsonResponse(422, {
        detail: [
          { loc: ['body', 'company'], msg: 'String should have at least 1 character' },
          { loc: ['body', 'deadline'], msg: 'Input should be a valid date' },
        ],
      }),
    )

    const error = await failureOf(client.request('/applications', { method: 'POST', body: {} }))

    expect(error.kind).toBe('validation')
    expect(error.status).toBe(422)
    expect(error.fieldErrors).toEqual({
      company: 'String should have at least 1 character',
      deadline: 'Input should be a valid date',
    })
  })

  it('keeps only the first message when a field fails twice', async () => {
    const { client } = clientAnswering(
      jsonResponse(422, {
        detail: [
          { loc: ['body', 'company'], msg: 'first' },
          { loc: ['body', 'company'], msg: 'second' },
        ],
      }),
    )

    const error = await failureOf(client.request('/applications'))

    expect(error.fieldErrors).toEqual({ company: 'first' })
  })

  it('treats the PATCH "cannot be null" rule as a general error, not a field error', async () => {
    const { client } = clientAnswering(
      jsonResponse(422, {
        detail: [{ loc: ['body'], msg: 'Value error, company cannot be null' }],
      }),
    )

    const error = await failureOf(client.request('/applications/1', { method: 'PATCH' }))

    expect(error.kind).toBe('validation')
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe('company cannot be null')
  })

  it('falls back to a generic message when detail is not a list', async () => {
    const { client } = clientAnswering(jsonResponse(422, { detail: 'weird' }))

    const error = await failureOf(client.request('/x'))

    expect(error.kind).toBe('validation')
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe('Invalid data')
  })
})

describe('other error statuses', () => {
  it('404 becomes not_found', async () => {
    const { client } = clientAnswering(jsonResponse(404, { detail: 'Application not found' }))

    const error = await failureOf(client.request('/applications/9'))

    expect(error.kind).toBe('not_found')
    expect(error.status).toBe(404)
  })

  it('502 becomes upstream with a clear message', async () => {
    const { client } = clientAnswering(jsonResponse(502, { detail: 'AI extraction failed' }))

    const error = await failureOf(client.request('/job-postings/extract', { method: 'POST' }))

    expect(error.kind).toBe('upstream')
    expect(error.message).toMatch(/AI service failed/)
  })

  it('503 becomes unavailable with a clear message', async () => {
    const { client } = clientAnswering(jsonResponse(503, { detail: 'no key' }))

    const error = await failureOf(client.request('/job-postings/extract', { method: 'POST' }))

    expect(error.kind).toBe('unavailable')
    expect(error.message).toMatch(/not available/)
  })

  it('an unknown status with a non-JSON body still gives an error', async () => {
    const { client } = clientAnswering(new Response('<html>oops</html>', { status: 500 }))

    const error = await failureOf(client.request('/x'))

    expect(error.kind).toBe('http')
    expect(error.status).toBe(500)
    expect(error.message).toBe('Unexpected error (HTTP 500).')
  })
})

describe('network failure', () => {
  it('"Failed to fetch" becomes a network error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createApiClient({ baseUrl: BASE, fetchFn })

    const error = await failureOf(client.request('/health'))

    expect(error.kind).toBe('network')
    expect(error.message).toMatch(/Cannot reach the API/)
  })
})

describe('timeout and cancellation', () => {
  it('gives up after the default timeout with a clear message', async () => {
    vi.useFakeTimers()
    const client = createApiClient({
      baseUrl: BASE,
      fetchFn: neverAnsweringFetch(),
      defaultTimeoutMs: 5_000,
    })

    const pending = failureOf(client.request('/health'))
    await vi.advanceTimersByTimeAsync(5_000)
    const error = await pending

    expect(error.kind).toBe('timeout')
    expect(error.message).toBe('The server took more than 5 seconds to answer. Try again.')
  })

  it('a per-call timeout overrides the default', async () => {
    vi.useFakeTimers()
    const client = createApiClient({
      baseUrl: BASE,
      fetchFn: neverAnsweringFetch(),
      defaultTimeoutMs: 5_000,
    })

    const pending = failureOf(client.request('/slow', { timeoutMs: 60_000 }))
    let settled = false
    void pending.then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(59_999)
    // Still waiting: the 5 s default no longer applies.
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect((await pending).kind).toBe('timeout')
  })

  it('does not leave a timer running once the answer has arrived', async () => {
    vi.useFakeTimers()
    const { client } = clientAnswering(jsonResponse(200, { ok: true }))

    await client.request('/health')

    expect(vi.getTimerCount()).toBe(0)
  })

  it('a caller cancel passes through as AbortError, not as an ApiError', async () => {
    const client = createApiClient({ baseUrl: BASE, fetchFn: neverAnsweringFetch() })
    const controller = new AbortController()

    const pending = client.request('/health', { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await expect(pending).rejects.not.toBeInstanceOf(ApiError)
  })
})
