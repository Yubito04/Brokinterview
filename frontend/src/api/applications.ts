import type { components } from './schema'
import type { ApiClient } from './client'
import { PAGE_SIZE, pageToOffset } from '../applications/pagination'

export type Application = components['schemas']['ApplicationRead']
export type ApplicationPage = components['schemas']['ApplicationPage']
export type ApplicationStatus = components['schemas']['ApplicationStatus']
export type ApplicationCreate = components['schemas']['ApplicationCreate']
// PATCH body: only the fields present are changed, and null clears an optional one.
export type ApplicationUpdate = components['schemas']['ApplicationUpdate']

// Typed as the generated union: if the backend adds a status, this line stops compiling.
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
]

// Reads the `status` URL parameter: an unknown value means "no filter", not an error.
// Case matters: the API only knows the upper-case names.
export function parseStatus(raw: string | null): ApplicationStatus | undefined {
  return APPLICATION_STATUSES.find((status) => status === raw)
}

export type ListParams = {
  status?: ApplicationStatus
  q?: string
  page: number
  signal?: AbortSignal
}

export function listApplications(
  client: ApiClient,
  { status, q, page, signal }: ListParams,
): Promise<ApplicationPage> {
  return client.request<ApplicationPage>('/applications', {
    query: {
      limit: PAGE_SIZE,
      offset: pageToOffset(page),
      status,
      // A search made only of spaces is "no search"; the client drops empty values.
      q: q?.trim(),
    },
    signal,
  })
}

export function getApplication(
  client: ApiClient,
  id: number,
  signal?: AbortSignal,
): Promise<Application> {
  return client.request<Application>(`/applications/${id}`, { signal })
}

// No retry, no signal: a write that was sent may have been applied even if the answer
// was lost, so repeating or cancelling it blindly could create a duplicate.
export function createApplication(client: ApiClient, body: ApplicationCreate): Promise<Application> {
  return client.request<Application>('/applications', { method: 'POST', body })
}

export function updateApplication(
  client: ApiClient,
  id: number,
  body: ApplicationUpdate,
): Promise<Application> {
  return client.request<Application>(`/applications/${id}`, { method: 'PATCH', body })
}

// Also deletes the application's contacts (cascade in the API): the screen says so
// before asking for the confirmation.
export function deleteApplication(client: ApiClient, id: number): Promise<void> {
  return client.request<void>(`/applications/${id}`, { method: 'DELETE' })
}
