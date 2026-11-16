import { useId, useState, type FormEvent, type ReactNode } from 'react'
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
  // Inside another screen (the import): a section with a second-level heading instead of a
  // whole page, so that the page keeps one <main> and one <h1>.
  embedded?: boolean
  // Content shown between the heading and the fields (the import's warning and skills).
  intro?: ReactNode
  // A short note under a field, by field name (the import's "not found in the posting").
  hints?: Partial<Record<'company' | 'position' | 'location' | 'deadline', string>>
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
  embedded = false,
  intro,
  hints,
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

  const headingId = useId()
  const Wrapper = embedded ? 'section' : 'main'
  const Heading = embedded ? 'h2' : 'h1'

  return (
    // A <section> is only announced as a region when it is named: here, by its heading.
    <Wrapper
      aria-labelledby={embedded ? headingId : undefined}
      className={embedded ? 'mt-8' : 'mx-auto max-w-xl p-8'}
    >
      <Heading id={headingId} className={embedded ? 'text-xl font-semibold' : 'text-3xl font-bold'}>{title}</Heading>
      {intro}

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
          hint={hints?.company}
        />
        <TextField
          label={t('form.position')}
          required
          value={values.position}
          onChange={set('position')}
          error={fieldError('position')}
          hint={hints?.position}
        />
        <StatusField value={values.status} onChange={set('status')} error={fieldError('status')} />
        <TextField
          label={t('form.location')}
          value={values.location}
          onChange={set('location')}
          error={fieldError('location')}
          hint={hints?.location}
        />
        <TextField
          label={t('form.deadline')}
          type="date"
          value={values.deadline}
          onChange={set('deadline')}
          error={fieldError('deadline')}
          hint={hints?.deadline}
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
    </Wrapper>
  )
}
