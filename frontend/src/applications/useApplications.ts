import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { listApplications, type ApplicationStatus } from '../api/applications'

type Filters = { status?: ApplicationStatus; q: string; page: number }

export function useApplications({ status, q, page }: Filters) {
  const search = q.trim()
  return useQuery({
    // Same key = same cache entry: changing any filter is a new query.
    queryKey: ['applications', { status, q: search, page }],
    // `signal` lets TanStack Query cancel the request when the key changes.
    queryFn: ({ signal }) => listApplications(api, { status, q: search, page, signal }),
    // While the new page loads, keep showing the previous one (no blank flash).
    placeholderData: keepPreviousData,
  })
}
