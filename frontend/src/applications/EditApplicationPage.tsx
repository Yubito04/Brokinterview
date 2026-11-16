import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { api, ApiError } from '../api'
import { getApplication, updateApplication, type Application } from '../api/applications'
import { describeError } from '../i18n/describeError'
import { useT } from '../i18n/useT'
import { ApplicationForm } from './ApplicationForm'
import {
  isEmptyUpdate,
  toUpdateBody,
  valuesFromApplication,
  type FormValues,
} from './formValues'
import { NOTICE_STATE_KEY } from './notice'

// "12" gives 12; "abc", "0", "-3" and "1.5" give nothing (the same rule as the page
// number in the list URL: an invalid value is never sent to the API).
function parseId(raw: string | undefined): number | undefined {
  return raw !== undefined && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw))
    ? Number(raw)
    : undefined
}

export function EditApplicationPage() {
  const t = useT()
  const id = parseId(useParams().id)

  const query = useQuery({
    queryKey: ['application', id],
    queryFn: ({ signal }) => getApplication(api, id!, signal),
    enabled: id !== undefined,
  })

  if (id === undefined) return <Message text={t('form.notFound')} />
  if (query.isPending) return <Message text={t('form.loading')} status />
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.kind === 'not_found'
    return (
      <Message
        text={
          notFound
            ? t('form.notFound')
            : t('form.loadError', { reason: describeError(query.error, t) })
        }
      />
    )
  }
  return <EditForm application={query.data} />
}

function Message({ text, status = false }: { text: string; status?: boolean }) {
  const t = useT()
  return (
    <main className="mx-auto max-w-xl p-8">
      <p role={status ? 'status' : 'alert'}>{text}</p>
      <Link to="/" className="mt-4 inline-block underline">
        {t('form.backToList')}
      </Link>
    </main>
  )
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
