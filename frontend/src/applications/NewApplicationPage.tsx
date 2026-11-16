import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { createApplication } from '../api/applications'
import { useT } from '../i18n/useT'
import { ApplicationForm } from './ApplicationForm'
import { EMPTY_FORM, toCreateBody } from './formValues'
import { NOTICE_STATE_KEY } from './notice'

export function NewApplicationPage() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // No retry (the default for a mutation): a POST sent twice would create two rows.
  const mutation = useMutation({
    mutationFn: (values: typeof EMPTY_FORM) => createApplication(api, toCreateBody(values)),
    onSuccess: async () => {
      // The saved list is out of date: every cached page of it must be read again.
      await queryClient.invalidateQueries({ queryKey: ['applications'] })
      void navigate('/', { state: { [NOTICE_STATE_KEY]: 'created' } })
    },
  })

  return (
    <ApplicationForm
      title={t('form.titleNew')}
      submitLabel={t('form.submitCreate')}
      initialValues={EMPTY_FORM}
      error={mutation.error}
      saving={mutation.isPending}
      onSubmit={(values) => mutation.mutate(values)}
      onCancel={() => void navigate('/')}
    />
  )
}
