import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api'
import { describeError, describeIssue } from '../i18n/describeError'
import { useT } from '../i18n/useT'
import type { FormValues } from './formValues'
import { StatusField, TextField } from './fields'

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
  const formRef = useRef<HTMLFormElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  const apiError = error instanceof ApiError ? error : undefined
  const fieldError = (name: string) => {
    const issue = apiError?.fieldErrors[name]
    return issue ? describeIssue(issue, t) : undefined
  }

  // What does not belong under a field goes in one block above the form: network
  // errors, server errors, and 422 issues about a field this form does not have.
  const summary: string[] = []
  if (error && apiError?.kind !== 'validation') summary.push(describeError(error, t))
  if (apiError) {
    for (const issue of apiError.formErrors) summary.push(describeIssue(issue, t))
    for (const [name, issue] of Object.entries(apiError.fieldErrors)) {
      if (!FIELD_NAMES.includes(name)) summary.push(describeIssue(issue, t))
    }
  }

  // After a failed attempt the keyboard goes to the first thing to fix: the first
  // invalid field, or the summary when no field is concerned. Otherwise a keyboard
  // or screen reader user would stay on the button with no idea what happened.
  useEffect(() => {
    if (!error) return
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    ;(firstInvalid ?? summaryRef.current)?.focus()
  }, [error])

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
        {summary.length > 0 && (
          <div
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded border border-red-700 p-3 text-red-700"
          >
            <p className="font-medium">{t('form.saveFailed')}</p>
            <ul className="list-inside list-disc">
              {summary.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ul>
          </div>
        )}

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
