import { useMutation } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { extractJobPosting } from '../api/jobPostings'
import { useT } from '../i18n/useT'
import { ApplicationForm } from './ApplicationForm'
import { ErrorSummary } from './ErrorSummary'
import { reviewFromExtraction, type ExtractionReview } from './extractionReview'
import { TextAreaField } from './fields'
import { useCreateApplication } from './useCreateApplication'
import { useServerErrors } from './useServerErrors'

// What the AI found, and which attempt it came from. A new attempt gets a new number: the
// review form is rebuilt from the new answer instead of keeping the old one's fields.
type Reviewed = { review: ExtractionReview; attempt: number }

const FIELD_NAMES = ['text']

export function ImportApplicationPage() {
  const t = useT()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [reviewed, setReviewed] = useState<Reviewed | null>(null)
  // The text step is open until there is an answer, then folded: the posting stays
  // available to read next to the fields, and to extract again.
  const [textOpen, setTextOpen] = useState(true)
  const controller = useRef<AbortController | null>(null)

  const extraction = useMutation({
    mutationFn: (posting: string) => {
      controller.current = new AbortController()
      return extractJobPosting(api, posting, controller.current.signal)
    },
    onSuccess: (job) => {
      setReviewed((previous) => ({
        review: reviewFromExtraction(job),
        attempt: (previous?.attempt ?? 0) + 1,
      }))
      setTextOpen(false)
    },
  })
  const creation = useCreateApplication()
  const { formRef, summaryRef, fieldError, summary } = useServerErrors(extraction.error, FIELD_NAMES)

  function handleExtract(event: FormEvent) {
    event.preventDefault()
    extraction.mutate(text)
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
          error={creation.error}
          saving={creation.isPending}
          onSubmit={(values) => creation.mutate(values)}
          onCancel={() => void navigate('/')}
        />
      )}
    </main>
  )
}
