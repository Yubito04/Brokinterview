import { useSearchParams } from 'react-router'
import { parseStatus, type ApplicationStatus } from '../api/applications'
import { parsePage } from './pagination'

// The filters live in the URL (?status=OFFER&q=acme&page=2): the page can be
// bookmarked, shared, reloaded, and Back/Forward move between filter states.
export function useApplicationFilters() {
  const [params, setParams] = useSearchParams()

  const status = parseStatus(params.get('status'))
  const q = params.get('q') ?? ''
  const page = parsePage(params.get('page'))

  // replace: true overwrites the current history entry instead of adding one.
  function change(edit: (next: URLSearchParams) => void, replace: boolean) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        edit(next)
        return next
      },
      { replace },
    )
  }

  return {
    status,
    q,
    page,
    // A new filter is a real navigation (push) and starts again at page 1.
    setStatus(value: ApplicationStatus | undefined) {
      change((next) => {
        if (value) next.set('status', value)
        else next.delete('status')
        next.delete('page')
      }, false)
    },
    // Typing must not fill the history: one entry per keystroke would make
    // "Back" undo letters one by one. So the search replaces the current entry.
    setQuery(value: string) {
      change((next) => {
        if (value) next.set('q', value)
        else next.delete('q')
        next.delete('page')
      }, true)
    },
    // Changing page is a real navigation (push), unless it is a correction
    // (replace: true), e.g. leaving a page that no longer exists.
    setPage(value: number, options: { replace?: boolean } = {}) {
      change((next) => {
        if (value <= 1) next.delete('page')
        else next.set('page', String(value))
      }, options.replace ?? false)
    },
  }
}
