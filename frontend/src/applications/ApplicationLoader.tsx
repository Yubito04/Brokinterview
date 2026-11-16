import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { api, ApiError } from '../api'
import { getApplication, type Application } from '../api/applications'
import { describeError } from '../i18n/describeError'
import { useT } from '../i18n/useT'

// "12" gives 12; "abc", "0", "-3" and "1.5" give nothing (the same rule as the page
// number in the list URL: an invalid value is never sent to the API).
function parseId(raw: string | undefined): number | undefined {
  return raw !== undefined && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw))
    ? Number(raw)
    : undefined
}

export function PageMessage({ text, status = false }: { text: string; status?: boolean }) {
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

type Props = {
  // What to show once the application of the URL (/applications/:id/...) is loaded.
  children: (application: Application) => ReactNode
}

// The part the detail page and the edit page have in common: read the id from the URL,
// load that application, and show the right message while it is loading, missing or
// failing. The cache key ['application', id] is shared, so going from the detail to the
// edit page does not load it twice.
export function ApplicationLoader({ children }: Props) {
  const t = useT()
  const id = parseId(useParams().id)

  const query = useQuery({
    queryKey: ['application', id],
    queryFn: ({ signal }) => getApplication(api, id!, signal),
    enabled: id !== undefined,
  })

  if (id === undefined) return <PageMessage text={t('form.notFound')} />
  if (query.isPending) return <PageMessage text={t('form.loading')} status />
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.kind === 'not_found'
    return (
      <PageMessage
        text={
          notFound
            ? t('form.notFound')
            : t('form.loadError', { reason: describeError(query.error, t) })
        }
      />
    )
  }
  return <>{children(query.data)}</>
}
