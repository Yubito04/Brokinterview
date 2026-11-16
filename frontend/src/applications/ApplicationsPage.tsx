import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApplicationList } from './ApplicationList'
import { PaginationNav } from './PaginationNav'
import { SearchBox } from './SearchBox'
import { StatusFilter } from './StatusFilter'
import { describeError } from '../i18n/describeError'
import { useT } from '../i18n/useT'
import { readNotice } from './notice'
import { clampPage, totalPages } from './pagination'
import { useApplicationFilters } from './useApplicationFilters'
import { useApplications } from './useApplications'

export function ApplicationsPage() {
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  // The confirmation sent by the form page ("created", "updated"). Kept in this state,
  // then removed from the history entry: a reload (F5) must not show it a second time.
  const [notice] = useState(() => readNotice(location.state))
  useEffect(() => {
    if (readNotice(location.state)) {
      void navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    }
  }, [location, navigate])
  const { status, q, page, setStatus, setQuery, setPage } = useApplicationFilters()
  const query = useApplications({ status, q, page })
  const { data } = query
  const hasFilters = status !== undefined || q.trim() !== ''
  // Placeholder data = the previous answer, shown while the new one loads.
  const reloading = query.isPlaceholderData

  // A page past the end (hand-edited URL, rows deleted elsewhere) goes back to
  // the last page. Not while showing stale data: it belongs to other filters.
  const lastPage = data ? clampPage(page, data.total) : page
  useEffect(() => {
    if (data && !reloading && lastPage !== page) setPage(lastPage, { replace: true })
  }, [data, reloading, lastPage, page, setPage])

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t('applications.title')}</h1>
        <Link to="/applications/new" className="rounded bg-blue-700 px-4 py-2 text-white">
          {t('applications.new')}
        </Link>
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded border border-green-700 p-3 text-green-800">
          {t(`notice.${notice}`)}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <SearchBox value={q} onSearch={setQuery} />
        <StatusFilter value={status} onChange={setStatus} />
      </div>

      {/* A live region must exist before its text changes to be announced,
          so it is always rendered, empty most of the time. */}
      <p role="status" className="mt-2 h-5 text-sm text-gray-600">
        {query.isFetching && data ? t('applications.updating') : ''}
      </p>

      <div className="mt-2">
        {query.isPending && <p role="status">{t('applications.loading')}</p>}

        {query.isError && (
          <div role="alert" className="text-red-700">
            <p>{t('applications.loadError', { reason: describeError(query.error, t) })}</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-2 rounded border border-red-700 px-3 py-1.5"
            >
              {t('applications.retry')}
            </button>
          </div>
        )}

        {data && data.total === 0 && (
          <p>
            {hasFilters
              ? t('applications.empty.filtered')
              : t('applications.empty.none')}
          </p>
        )}

        {data && data.items.length > 0 && (
          <div className="flex flex-col gap-6">
            <ApplicationList applications={data.items} stale={reloading} />
            <PaginationNav
              page={page}
              totalPages={totalPages(data.total)}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </main>
  )
}
