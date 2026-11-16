import type { components } from './schema'
import type { ApiClient } from './client'

export type Contact = components['schemas']['ContactRead']
export type ContactState = components['schemas']['ContactState']
export type ContactCreate = components['schemas']['ContactCreate']
// PATCH body: only the fields present are changed, and null clears a date.
export type ContactUpdate = components['schemas']['ContactUpdate']

// Typed as the generated union: if the backend adds a state, this line stops compiling.
export const CONTACT_STATES: readonly ContactState[] = ['NOT_CONTACTED', 'WAITING', 'REPLIED']

// The contacts of one application, oldest first (the API's order).
export function listContacts(
  client: ApiClient,
  applicationId: number,
  signal?: AbortSignal,
): Promise<Contact[]> {
  return client.request<Contact[]>(`/applications/${applicationId}/contacts`, { signal })
}

// Writes: no retry and no signal, for the reason given in applications.ts.
export function createContact(
  client: ApiClient,
  applicationId: number,
  body: ContactCreate,
): Promise<Contact> {
  return client.request<Contact>(`/applications/${applicationId}/contacts`, {
    method: 'POST',
    body,
  })
}

// A contact is addressed by its own id: its application is not in the URL.
export function updateContact(
  client: ApiClient,
  contactId: number,
  body: ContactUpdate,
): Promise<Contact> {
  return client.request<Contact>(`/contacts/${contactId}`, { method: 'PATCH', body })
}

export function deleteContact(client: ApiClient, contactId: number): Promise<void> {
  return client.request<void>(`/contacts/${contactId}`, { method: 'DELETE' })
}
