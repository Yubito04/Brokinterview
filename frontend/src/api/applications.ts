import type { components } from './schema'
import type { ApiClient } from './client'
import { PAGE_SIZE, pageToOffset } from '../applications/pagination'

export type Application = components['schemas']['ApplicationRead']
export type ApplicationPage = components['schemas']['ApplicationPage']
export type ApplicationStatus = components['schemas']['ApplicationStatus']

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
