import { useNavigate } from 'react-router'
import { useT } from '../i18n/useT'
import { ApplicationForm } from './ApplicationForm'
import { EMPTY_FORM } from './formValues'
import { useCreateApplication } from './useCreateApplication'

export function NewApplicationPage() {
  const t = useT()
  const navigate = useNavigate()
  const mutation = useCreateApplication()

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
