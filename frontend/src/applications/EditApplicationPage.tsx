import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { updateApplication, type Application } from '../api/applications'
import { useT } from '../i18n/useT'
import { ApplicationForm } from './ApplicationForm'
import { ApplicationLoader } from './ApplicationLoader'
import {
  isEmptyUpdate,
  toUpdateBody,
  valuesFromApplication,
  type FormValues,
} from './formValues'
import { NOTICE_STATE_KEY } from './notice'

export function EditApplicationPage() {
  return <ApplicationLoader>{(application) => <EditForm application={application} />}</ApplicationLoader>
}

function EditForm({ application }: { application: Application }) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateApplication(api, application.id, toUpdateBody(application, values)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
        queryClient.invalidateQueries({ queryKey: ['application', application.id] }),
      ])
      void navigate('/', { state: { [NOTICE_STATE_KEY]: 'updated' } })
    },
  })

  function handleSubmit(values: FormValues) {
    // Nothing changed: no request, and no "updated" message that would be a lie.
    if (isEmptyUpdate(toUpdateBody(application, values))) {
      void navigate('/')
      return
    }
    mutation.mutate(values)
  }

  return (
    <ApplicationForm
      title={t('form.titleEdit')}
      submitLabel={t('form.submitEdit')}
      initialValues={valuesFromApplication(application)}
      error={mutation.error}
      saving={mutation.isPending}
      onSubmit={handleSubmit}
      onCancel={() => void navigate('/')}
    />
  )
}
