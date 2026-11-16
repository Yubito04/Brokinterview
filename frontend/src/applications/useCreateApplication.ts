import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { createApplication } from '../api/applications'
import { toCreateBody, type FormValues } from './formValues'
import { NOTICE_STATE_KEY } from './notice'

// Creating an application from the values of the form, then back to the list with the
// "created" confirmation. Shared by the blank form and the one filled from an extraction.
// No retry (the default for a mutation): a POST sent twice would create two rows.
export function useCreateApplication() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: FormValues) => createApplication(api, toCreateBody(values)),
    onSuccess: async () => {
      // The saved list is out of date: every cached page of it must be read again.
      await queryClient.invalidateQueries({ queryKey: ['applications'] })
      void navigate('/', { state: { [NOTICE_STATE_KEY]: 'created' } })
    },
  })
}
