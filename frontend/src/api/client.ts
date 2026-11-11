import { ApiError, errorFromResponse } from './errors'

export const DEFAULT_TIMEOUT_MS = 10_000
// The AI extraction is slow (the model has to read and answer): 60 s, double the
// 30 s minimum, because giving up early wastes a paid call.
export const EXTRACTION_TIMEOUT_MS = 60_000

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  // Overrides the client's default maximum wait for this one call.
  timeoutMs?: number
  // Lets a screen cancel the call (e.g. the user leaves the page).
  signal?: AbortSignal
}

type ClientConfig = {
  baseUrl: string
  defaultTimeoutMs?: number
  // Injectable so the tests can fake the network.
  fetchFn?: typeof fetch
}

export function createApiClient({
  baseUrl,
  defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn = (...args) => fetch(...args),
}: ClientConfig) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, query, signal: callerSignal } = options
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== '') params.set(key, String(value))
    }
    const queryString = params.size > 0 ? `?${params}` : ''

    // AbortController: a remote control for one request. fetch() is given its
    // `signal`; calling controller.abort() later makes fetch stop at once and reject.
    // We use it for two reasons: the timeout below, and the caller's own cancel.
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true // remembered, to tell "too slow" apart from "cancelled"
      controller.abort()
    }, timeoutMs)
    const forwardCancel = () => controller.abort()
    if (callerSignal?.aborted) forwardCancel()
    callerSignal?.addEventListener('abort', forwardCancel)

    try {
      const response = await fetchFn(`${baseUrl}${path}${queryString}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) throw await errorFromResponse(response)
      if (response.status === 204) return undefined as T
      return (await response.json()) as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (timedOut) {
        throw new ApiError(
          'timeout',
          `The server took more than ${Math.round(timeoutMs / 1000)} seconds to answer. Try again.`,
        )
      }
      // The caller cancelled on purpose: not a failure to show, so it passes through.
      if (callerSignal?.aborted) throw error
      // Browsers report CORS errors, API off and no connection all as "Failed to fetch".
      throw new ApiError('network', 'Cannot reach the API. Is the server running?')
    } finally {
      clearTimeout(timer) // finished in time: the alarm must not go off later
      callerSignal?.removeEventListener('abort', forwardCancel)
    }
  }

  return { request }
}

export type ApiClient = ReturnType<typeof createApiClient>
