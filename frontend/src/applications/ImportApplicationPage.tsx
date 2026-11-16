import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { extractJobPosting } from '../api/jobPostings'
import { useT } from '../i18n/useT'
import { ApplicationForm } from './ApplicationForm'
import { ErrorSummary } from './ErrorSummary'
import {
  hasManualChanges,
  reviewFromExtraction,
  type ExtractedField,
  type ExtractionReview,
} from './extractionReview'
import { TextAreaField } from './fields'
import type { FormValues } from './formValues'
import { useCreateApplication } from './useCreateApplication'
import { useServerErrors } from './useServerErrors'

// What the AI found, and which attempt it came from. A new attempt gets a new number: the
// review form is rebuilt from the new answer instead of keeping the old one's fields.
type Reviewed = { review: ExtractionReview; attempt: number }

const FIELD_NAMES = ['text']

// What is shown above the fields of the review. The AI can be WRONG in what it filled in,
// not only silent about what it did not find. The evaluation on real postings (ADR 006)
// found two fields to double-check: the position (null, reworded or another title from one
// run to the next, when the text names none clearly) and the deadline (a posting with
// several dates: one is chosen without saying so). The warning names those two.
function ReviewIntro({ skills }: { skills: string[] }) {
  const t = useT()
  return (
    <>
      <p className="mt-3 rounded border border-amber-600 p-3 text-amber-900">{t('import.aiWarning')}</p>
      <div className="mt-4">
        <h3 className="font-medium">{t('import.skillsTitle')}</h3>
        {skills.length === 0 ? (
          <p className="mt-1">{t('import.skillsNone')}</p>
        ) : (
          // Plain text in a list: what the AI wrote is never read as markup.
          <ul className="mt-1 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li key={skill} className="rounded border border-gray-400 px-2 py-0.5">
                {skill}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-sm text-gray-600">{t('import.skillsNote')}</p>
      </div>
    </>
  )
}

function notFoundHints(notFound: ExtractedField[], text: string) {
  return Object.fromEntries(notFound.map((field) => [field, text])) as Partial<Record<ExtractedField, string>>
}

export function ImportApplicationPage() {
  const t = useT()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [reviewed, setReviewed] = useState<Reviewed | null>(null)
  // The text step is open until there is an answer, then folded: the posting stays
  // available to read next to the fields, and to extract again.
  const [textOpen, setTextOpen] = useState(true)
  const controller = useRef<AbortController | null>(null)
  // What the review form holds right now (it owns its state; it tells us after each change).
  const currentValues = useRef<FormValues | null>(null)
  // A new extraction would replace corrections made by hand: ask first.
  const [askingOverwrite, setAskingOverwrite] = useState(false)
  const keepButton = useRef<HTMLButtonElement>(null)
  const extractButton = useRef<HTMLButtonElement>(null)

  const extraction = useMutation({
    mutationFn: (posting: string) => {
      controller.current = new AbortController()
      return extractJobPosting(api, posting, controller.current.signal)
    },
    onSuccess: (job) => {
      const review = reviewFromExtraction(job)
      currentValues.current = review.values
      setReviewed((previous) => ({ review, attempt: (previous?.attempt ?? 0) + 1 }))
      setTextOpen(false)
    },
  })
  const creation = useCreateApplication()
  const { formRef, summaryRef, fieldError, summary } = useServerErrors(extraction.error, FIELD_NAMES)

  // The question opens: the keyboard goes to the SAFE choice (keep), so that a stray Enter
  // does not throw the user's corrections away.
  useEffect(() => {
    if (askingOverwrite) keepButton.current?.focus()
  }, [askingOverwrite])

  function handleExtract(event: FormEvent) {
    event.preventDefault()
    // Asked BEFORE the request, not after the answer: declining costs nothing.
    if (reviewed && currentValues.current && hasManualChanges(reviewed.review.values, currentValues.current)) {
      setAskingOverwrite(true)
      return
    }
    extraction.mutate(text)
  }

  function replaceCorrections() {
    setAskingOverwrite(false)
    extraction.mutate(text)
  }

  function keepCorrections() {
    setAskingOverwrite(false)
    extractButton.current?.focus()
  }

  function handleOverwriteKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') keepCorrections()
  }

  // The user stops waiting. The server may still finish the call (and pay for it): this
  // only stops OUR wait. The cancel is not a failure, so nothing is shown for it.
  function cancelExtraction() {
    controller.current?.abort()
    extraction.reset()
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">{t('import.title')}</h1>

      <details
        open={textOpen}
        onToggle={(event) => setTextOpen(event.currentTarget.open)}
        className="mt-6"
      >
        <summary className="cursor-pointer font-medium">{t('import.textLabel')}</summary>
        <form ref={formRef} noValidate onSubmit={handleExtract} className="mt-4 flex flex-col gap-4">
          <ErrorSummary summaryRef={summaryRef} messages={summary} title={t('import.failed')} />

          <TextAreaField
            label={t('import.textLabel')}
            value={text}
            onChange={setText}
            error={fieldError('text')}
          />

          <div className="flex gap-3">
            {/* Disabled while waiting: every extraction is a paid call, so a second click
                must not send a second one. */}
            <button
              ref={extractButton}
              type="submit"
              disabled={extraction.isPending}
              className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
            >
              {extraction.isPending ? t('import.extracting') : t('import.extract')}
            </button>
            {extraction.isPending && (
              <button
                type="button"
                onClick={cancelExtraction}
                className="rounded border border-gray-400 px-4 py-2"
              >
                {t('import.cancel')}
              </button>
            )}
          </div>

          {askingOverwrite && (
            <div
              role="group"
              aria-labelledby="overwrite-title"
              aria-describedby="overwrite-text"
              onKeyDown={handleOverwriteKeyDown}
              className="rounded border border-amber-600 p-4"
            >
              <h2 id="overwrite-title" className="font-semibold">
                {t('import.overwriteTitle')}
              </h2>
              <p id="overwrite-text" className="mt-1">
                {t('import.overwriteText')}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={replaceCorrections}
                  className="rounded bg-red-700 px-4 py-2 text-white"
                >
                  {t('import.overwriteConfirm')}
                </button>
                <button
                  ref={keepButton}
                  type="button"
                  onClick={keepCorrections}
                  className="rounded border border-gray-400 px-4 py-2"
                >
                  {t('import.overwriteKeep')}
                </button>
              </div>
            </div>
          )}
        </form>
      </details>

      {/* Always on the page, empty until needed, so that its change is announced. */}
      <p role="status" className="mt-2 min-h-6">
        {extraction.isPending ? t('import.extracting') : ''}
      </p>

      {reviewed && (
        <ApplicationForm
          key={reviewed.attempt}
          embedded
          title={t('import.reviewTitle')}
          submitLabel={t('form.submitCreate')}
          initialValues={reviewed.review.values}
          intro={<ReviewIntro skills={reviewed.review.skills} />}
          hints={notFoundHints(reviewed.review.notFound, t('import.notFound'))}
          error={creation.error}
          saving={creation.isPending}
          disabled={extraction.isPending}
          onValuesChange={(values) => {
            currentValues.current = values
          }}
          onSubmit={(values) => creation.mutate(values)}
          onCancel={() => void navigate('/')}
        />
      )}
    </main>
  )
}
