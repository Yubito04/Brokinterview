import { useEffect } from 'react'
import { ApplicationList } from './ApplicationList'
import { PaginationNav } from './PaginationNav'
import { SearchBox } from './SearchBox'
import { StatusFilter } from './StatusFilter'
import { clampPage, totalPages } from './pagination'
import { useApplicationFilters } from './useApplicationFilters'
import { useApplications } from './useApplications'

export function ApplicationsPage() {
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
      <h1 className="text-3xl font-bold">Candidatures</h1>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <SearchBox value={q} onSearch={setQuery} />
        <StatusFilter value={status} onChange={setStatus} />
      </div>

      {/* A live region must exist before its text changes to be announced,
          so it is always rendered, empty most of the time. */}
      <p role="status" className="mt-2 h-5 text-sm text-gray-600">
        {query.isFetching && data ? 'Mise à jour…' : ''}
      </p>

      <div className="mt-2">
        {query.isPending && <p role="status">Chargement des candidatures…</p>}

        {query.isError && (
          <div role="alert" className="text-red-700">
            <p>Impossible de charger les candidatures : {query.error.message}</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-2 rounded border border-red-700 px-3 py-1.5"
            >
              Réessayer
            </button>
          </div>
        )}

        {data && data.total === 0 && (
          <p>
            {hasFilters
              ? 'Aucune candidature ne correspond aux filtres actuels.'
              : "Aucune candidature pour l'instant."}
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
