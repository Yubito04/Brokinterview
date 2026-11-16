import { useState, type FormEvent } from 'react'
import { useT } from '../i18n/useT'
import type { FormValues } from './formValues'
import { StatusField, TextField } from './fields'
import { ErrorSummary } from './ErrorSummary'
import { useServerErrors } from './useServerErrors'

type Props = {
  title: string
  submitLabel: string
  initialValues: FormValues
  // The server's answer to the last attempt, if it failed.
  error: unknown
  saving: boolean
  onSubmit: (values: FormValues) => void
  onCancel: () => void
}

const FIELD_NAMES = ['company', 'position', 'status', 'location', 'deadline']

export function ApplicationForm({
  title,
  submitLabel,
  initialValues,
  error,
  saving,
  onSubmit,
  onCancel,
}: Props) {
  const t = useT()
  const [values, setValues] = useState(initialValues)
  const { formRef, summaryRef, fieldError, summary } = useServerErrors(error, FIELD_NAMES)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(values)
  }

  const set = <K extends keyof FormValues>(name: K) => (value: FormValues[K]) =>
    setValues((current) => ({ ...current, [name]: value }))

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-3xl font-bold">{title}</h1>

      {/* noValidate: the browser's own validation bubbles are in the browser's
          language, not the app's. The server's 422 answers, translated, are shown
          under each field instead. */}
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <ErrorSummary summaryRef={summaryRef} messages={summary} />

        <p className="text-sm text-gray-600">{t('form.requiredNote')}</p>

        <TextField
          label={t('form.company')}
          required
          value={values.company}
          onChange={set('company')}
          error={fieldError('company')}
        />
        <TextField
          label={t('form.position')}
          required
          value={values.position}
          onChange={set('position')}
          error={fieldError('position')}
        />
        <StatusField value={values.status} onChange={set('status')} error={fieldError('status')} />
        <TextField
          label={t('form.location')}
          value={values.location}
          onChange={set('location')}
          error={fieldError('location')}
        />
        <TextField
          label={t('form.deadline')}
          type="date"
          value={values.deadline}
          onChange={set('deadline')}
          error={fieldError('deadline')}
        />

        <div className="flex gap-3">
          {/* disabled while saving: a second click would send a second request,
              and a second POST would create a duplicate. */}
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
          >
            {saving ? t('form.saving') : submitLabel}
          </button>
          <button type="button" onClick={onCancel} className="rounded border border-gray-400 px-4 py-2">
            {t('form.cancel')}
          </button>
        </div>
      </form>
    </main>
  )
}
