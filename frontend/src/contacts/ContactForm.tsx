import { useEffect, useState, type FormEvent } from 'react'
import { TextField } from '../applications/fields'
import { ErrorSummary } from '../applications/ErrorSummary'
import { useServerErrors } from '../applications/useServerErrors'
import { useT } from '../i18n/useT'
import type { ContactFormValues } from './contactValues'

type Props = {
  title: string
  submitLabel: string
  initialValues: ContactFormValues
  // The server's answer to the last attempt, if it failed.
  error: unknown
  saving: boolean
  onSubmit: (values: ContactFormValues) => void
  onCancel: () => void
}

// The API's names for the fields of this form (not the form's own names).
const FIELD_NAMES = ['name', 'contacted_at', 'replied_at']

// The same rules as the application form: no validation of its own, the server's 422
// answers are shown, translated, under each field (see ApplicationForm).
export function ContactForm({
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

  // The form opens in the middle of the page: the keyboard goes to its first field.
  useEffect(() => {
    formRef.current?.querySelector('input')?.focus()
  }, [formRef])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(values)
  }

  const set = <K extends keyof ContactFormValues>(name: K) => (value: ContactFormValues[K]) =>
    setValues((current) => ({ ...current, [name]: value }))

  return (
    <section aria-labelledby="contact-form-heading" className="mt-6 rounded border border-gray-300 p-4">
      <h3 id="contact-form-heading" className="text-lg font-semibold">
        {title}
      </h3>
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <ErrorSummary summaryRef={summaryRef} messages={summary} />

        <p className="text-sm text-gray-600">{t('form.requiredNote')}</p>

        <TextField
          label={t('contacts.name')}
          required
          value={values.name}
          onChange={set('name')}
          error={fieldError('name')}
        />
        <TextField
          label={t('contacts.contactedAt')}
          type="datetime-local"
          value={values.contactedAt}
          onChange={set('contactedAt')}
          error={fieldError('contacted_at')}
        />
        <TextField
          label={t('contacts.repliedAt')}
          type="datetime-local"
          value={values.repliedAt}
          onChange={set('repliedAt')}
          error={fieldError('replied_at')}
        />

        <div className="flex gap-3">
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
    </section>
  )
}
