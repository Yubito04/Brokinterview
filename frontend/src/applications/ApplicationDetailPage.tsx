import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { deleteApplication, type Application } from '../api/applications'
import { ContactList } from '../contacts/ContactList'
import { useContacts } from '../contacts/useContacts'
import { describeError } from '../i18n/describeError'
import { useT, type Translate } from '../i18n/useT'
import { ApplicationLoader } from './ApplicationLoader'
import { formatDeadline } from './formatDeadline'
import { NOTICE_STATE_KEY } from './notice'

export function ApplicationDetailPage() {
  return <ApplicationLoader>{(application) => <Detail application={application} />}</ApplicationLoader>
}

// What the user is told will be lost: the contacts go with the application (cascade in
// the API). While the count is not known (loading, or the contacts failed to load), the
// text says "its contacts, if any" instead of a number that could be wrong.
function deletionText(t: Translate, company: string, contactCount: number | undefined): string {
  if (contactCount === undefined) return t('detail.deleteUnknown', { company })
  if (contactCount === 0) return t('detail.deleteNone', { company })
  if (contactCount === 1) return t('detail.deleteOne', { company })
  return t('detail.deleteMany', { company, count: contactCount })
}

function Detail({ application }: { application: Application }) {
  const t = useT()
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const contacts = useContacts(application.id)

  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const failureRef = useRef<HTMLParagraphElement>(null)

  // No retry (the default for a mutation). A DELETE is safe to repeat, but the user is
  // the one who decides.
  const mutation = useMutation({
    mutationFn: () => deleteApplication(api, application.id),
    onSuccess: () => {
      deleted.current = true
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
      void navigate('/', { state: { [NOTICE_STATE_KEY]: 'deleted' } })
    },
  })

  // Forget what was cached about the deleted application (reading it again would answer
  // 404), but only once this page is gone: removing a query while a screen still watches
  // it makes that screen request it again, which is exactly the 404 to avoid.
  const deleted = useRef(false)
  useEffect(
    () => () => {
      if (!deleted.current) return
      queryClient.removeQueries({ queryKey: ['application', application.id] })
      queryClient.removeQueries({ queryKey: ['contacts', application.id] })
    },
    [queryClient, application.id],
  )

  // The question opens: the keyboard goes to the SAFE choice (Cancel), not to the
  // destructive one, so that a stray Enter does not delete.
  useEffect(() => {
    if (confirming) cancelButton.current?.focus()
  }, [confirming])

  // After a failure the buttons were disabled, so the focus was lost: put it on the error.
  useEffect(() => {
    if (mutation.isError) failureRef.current?.focus()
  }, [mutation.isError])

  function cancel() {
    if (mutation.isPending) return
    mutation.reset()
    setConfirming(false)
    deleteButton.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') cancel()
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link to="/" className="underline">
        {t('form.backToList')}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{application.company}</h1>
        <div className="flex gap-3">
          <Link
            to={`/applications/${application.id}/edit`}
            className="rounded border border-gray-400 px-4 py-2"
          >
            {t('detail.edit')}
          </Link>
          <button
            ref={deleteButton}
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded border border-red-700 px-4 py-2 text-red-700"
          >
            {t('detail.delete')}
          </button>
        </div>
      </div>

      {confirming && (
        <div
          role="group"
          aria-labelledby="delete-title"
          aria-describedby="delete-text"
          onKeyDown={handleKeyDown}
          className="mt-4 rounded border border-red-700 p-4"
        >
          <h2 id="delete-title" className="font-semibold">
            {t('detail.deleteTitle')}
          </h2>
          <p id="delete-text" className="mt-1">
            {deletionText(t, application.company, contacts.data?.length)}
          </p>
          {mutation.isError && (
            <p ref={failureRef} role="alert" tabIndex={-1} className="mt-2 text-red-700">
              {t('detail.deleteFailed', { reason: describeError(mutation.error, t) })}
            </p>
          )}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-60"
            >
              {mutation.isPending ? t('detail.deleting') : t('detail.confirmDelete')}
            </button>
            <button
              ref={cancelButton}
              type="button"
              disabled={mutation.isPending}
              onClick={cancel}
              className="rounded border border-gray-400 px-4 py-2"
            >
              {t('form.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* A description list: each term is announced with its value. */}
      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
        <dt className="font-medium">{t('table.position')}</dt>
        <dd>{application.position}</dd>
        <dt className="font-medium">{t('table.status')}</dt>
        <dd>{t(`status.${application.status}`)}</dd>
        <dt className="font-medium">{t('table.location')}</dt>
        <dd>{application.location ?? '—'}</dd>
        <dt className="font-medium">{t('table.deadline')}</dt>
        <dd>{formatDeadline(application.deadline, i18n.language)}</dd>
      </dl>

      <ContactList applicationId={application.id} />
    </main>
  )
}
