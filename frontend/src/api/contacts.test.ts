import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import { createContact, deleteContact, listContacts, updateContact } from './contacts'
import { ApiError } from './errors'

function clientAnswering(status: number, body?: unknown) {
  const fetchFn = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  return { client: createApiClient({ baseUrl: 'http://api.test', fetchFn }), fetchFn }
}

function sent(fetchFn: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
  return {
    path: new URL(url).pathname,
    method: init.method,
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
  }
}

const CONTACT = {
  id: 5,
  application_id: 7,
  name: 'Alice',
  contacted_at: '2026-11-01T10:00:00Z',
  replied_at: null,
  state: 'WAITING',
  created_at: '2026-11-01T09:00:00Z',
}

describe('listContacts', () => {
  it('reads the contacts of one application', async () => {
    const { client, fetchFn } = clientAnswering(200, [CONTACT])
    expect(await listContacts(client, 7)).toEqual([CONTACT])
    expect(sent(fetchFn)).toMatchObject({ path: '/applications/7/contacts', method: 'GET' })
  })
})

describe('createContact', () => {
  it('posts under the application and returns the saved contact', async () => {
    const { client, fetchFn } = clientAnswering(201, CONTACT)
    const result = await createContact(client, 7, { name: 'Alice' })
    expect(result).toEqual(CONTACT)
    expect(sent(fetchFn)).toEqual({
      path: '/applications/7/contacts',
      method: 'POST',
      body: { name: 'Alice' },
    })
  })

  it('exposes a 422 by field with its code', async () => {
    const detail = [
      { type: 'string_too_short', loc: ['body', 'name'], msg: 'x', ctx: { min_length: 1 } },
    ]
    const { client } = clientAnswering(422, { detail })
    const error = await createContact(client, 7, { name: '' }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors.name).toMatchObject({ type: 'string_too_short' })
  })
})

describe('updateContact', () => {
  it('patches the contact by its own id and keeps null to clear a date', async () => {
    const { client, fetchFn } = clientAnswering(200, CONTACT)
    await updateContact(client, 5, { replied_at: null })
    expect(sent(fetchFn)).toEqual({
      path: '/contacts/5',
      method: 'PATCH',
      body: { replied_at: null },
    })
  })
})

describe('deleteContact', () => {
  it('sends a DELETE and accepts the empty 204 answer', async () => {
    const { client, fetchFn } = clientAnswering(204)
    await expect(deleteContact(client, 5)).resolves.toBeUndefined()
    expect(sent(fetchFn)).toMatchObject({ path: '/contacts/5', method: 'DELETE' })
  })

  it('reports a contact that no longer exists', async () => {
    const { client } = clientAnswering(404, { detail: 'Contact not found' })
    const error = await deleteContact(client, 5).catch((caught: unknown) => caught)
    expect((error as ApiError).kind).toBe('not_found')
  })
})
