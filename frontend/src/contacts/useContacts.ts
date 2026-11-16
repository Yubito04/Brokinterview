import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { listContacts } from '../api/contacts'

// The contacts of one application. One place for the query, so that every screen that
// needs them (the list, the "delete this application?" question) shares the same cache
// entry: the key carries the application id, so two applications never mix.
export function useContacts(applicationId: number) {
  return useQuery({
    queryKey: ['contacts', applicationId],
    queryFn: ({ signal }) => listContacts(api, applicationId, signal),
  })
}
