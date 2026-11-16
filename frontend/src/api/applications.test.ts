import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import { ApiError } from './errors'
import {
  createApplication,
  getApplication,
  listApplications,
  parseStatus,
  updateApplication,
} from './applications'

function clientAnswering(body: unknown) {
  const fetchFn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  return { client: createApiClient({ baseUrl: 'http://api.test', fetchFn }), fetchFn }
}

function calledUrl(fetchFn: ReturnType<typeof vi.fn>): URL {
  return new URL(fetchFn.mock.calls[0][0] as string)
}

const EMPTY_PAGE = { items: [], total: 0, limit: 20, offset: 0 }

describe('parseStatus', () => {
  it('accepts the four known statuses', () => {
    expect(parseStatus('APPLIED')).toBe('APPLIED')
    expect(parseStatus('INTERVIEW')).toBe('INTERVIEW')
    expect(parseStatus('OFFER')).toBe('OFFER')
    expect(parseStatus('REJECTED')).toBe('REJECTED')
  })

  it.each([['absent', null], ['empty', ''], ['unknown', 'HIRED'], ['wrong case', 'applied']])(
    'means "no filter" when the value is %s',
    (_label, raw) => {
      expect(parseStatus(raw)).toBeUndefined()
    },
  )
})

describe('listApplications', () => {
  it('asks for the first page with limit 20 and no filter', async () => {
    const { client, fetchFn } = clientAnswering(EMPTY_PAGE)
    await listApplications(client, { page: 1 })
    const url = calledUrl(fetchFn)
    expect(url.pathname).toBe('/applications')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('offset')).toBe('0')
    expect(url.searchParams.has('status')).toBe(false)
    expect(url.searchParams.has('q')).toBe(false)
  })

  it('converts the page to an offset and sends the filters', async () => {
    const { client, fetchFn } = clientAnswering(EMPTY_PAGE)
    await listApplications(client, { page: 3, status: 'OFFER', q: 'acme' })
    const url = calledUrl(fetchFn)
    expect(url.searchParams.get('offset')).toBe('40')
    expect(url.searchParams.get('status')).toBe('OFFER')
    expect(url.searchParams.get('q')).toBe('acme')
  })

  it('trims the search and ignores a blank one', async () => {
    const trimmed = clientAnswering(EMPTY_PAGE)
    await listApplications(trimmed.client, { page: 1, q: '  acme ' })
    expect(calledUrl(trimmed.fetchFn).searchParams.get('q')).toBe('acme')

    const blank = clientAnswering(EMPTY_PAGE)
    await listApplications(blank.client, { page: 1, q: '   ' })
    expect(calledUrl(blank.fetchFn).searchParams.has('q')).toBe(false)
  })

  it('returns the page the API answered', async () => {
    const answer = { items: [], total: 45, limit: 20, offset: 40 }
    const { client } = clientAnswering(answer)
    expect(await listApplications(client, { page: 3 })).toEqual(answer)
  })
})

const SAVED = {
  id: 7,
  company: 'Acme',
  position: 'Developer',
  status: 'APPLIED',
  location: null,
  deadline: null,
  created_at: '2026-11-01T10:00:00Z',
}

function sentRequest(fetchFn: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
  return { url: new URL(url), method: init.method, body: JSON.parse(init.body as string) }
}

describe('getApplication', () => {
  it('reads one application by id', async () => {
    const { client, fetchFn } = clientAnswering(SAVED)
    expect(await getApplication(client, 7)).toEqual(SAVED)
    expect(calledUrl(fetchFn).pathname).toBe('/applications/7')
  })
})

describe('createApplication', () => {
  it('posts the body as JSON and returns the saved application', async () => {
    const { client, fetchFn } = clientAnswering(SAVED)
    const result = await createApplication(client, { company: 'Acme', position: 'Developer', status: 'APPLIED' })
    expect(result).toEqual(SAVED)
    const sent = sentRequest(fetchFn)
    expect(sent.method).toBe('POST')
    expect(sent.url.pathname).toBe('/applications')
    expect(sent.body).toEqual({ company: 'Acme', position: 'Developer', status: 'APPLIED' })
  })

  it('exposes the 422 issues by field, with their code', async () => {
    const detail = [
      { type: 'string_too_short', loc: ['body', 'company'], msg: 'x', ctx: { min_length: 1 } },
    ]
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn })

    const error = await createApplication(client, { company: '', position: 'x', status: 'APPLIED' }).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors.company).toMatchObject({
      type: 'string_too_short',
      ctx: { min_length: 1 },
    })
  })
})

describe('updateApplication', () => {
  it('patches only what it is given, and null stays null', async () => {
    const { client, fetchFn } = clientAnswering(SAVED)
    await updateApplication(client, 7, { status: 'OFFER', location: null })
    const sent = sentRequest(fetchFn)
    expect(sent.method).toBe('PATCH')
    expect(sent.url.pathname).toBe('/applications/7')
    expect(sent.body).toEqual({ status: 'OFFER', location: null })
  })
})
