import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import { listApplications, parseStatus } from './applications'

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
