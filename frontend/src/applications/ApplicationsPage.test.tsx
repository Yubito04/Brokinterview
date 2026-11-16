import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Application } from '../api/applications'
import { createI18n } from '../i18n/createI18n'
import { resources } from '../i18n/resources'
import { createQueryClient } from '../queryClient'
import { ApplicationsPage } from './ApplicationsPage'

// These tests look for elements the way a user (or a screen reader) finds them:
// by role and accessible name ("the button named Page suivante"), never by CSS
// class or position. If the label or the role is missing, the test fails, so
// the tests also guard accessibility.

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeApplication(id: number, overrides: Partial<Application> = {}): Application {
  return {
    id,
    company: `Company ${id}`,
    position: `Position ${id}`,
    status: 'APPLIED',
    location: null,
    deadline: null,
    created_at: '2026-11-01T10:00:00Z',
    ...overrides,
  }
}

// A tiny fake backend: answers like GET /applications (filter, search, slice).
function fakeApi(all: Application[]) {
  const fetchFn = vi.fn(async (input: string) => {
    const url = new URL(input)
    const status = url.searchParams.get('status')
    const q = url.searchParams.get('q')?.toLowerCase()
    const limit = Number(url.searchParams.get('limit'))
    const offset = Number(url.searchParams.get('offset'))
    const matching = all.filter(
      (a) =>
        (!status || a.status === status) &&
        (!q || a.company.toLowerCase().includes(q) || a.position.toLowerCase().includes(q)),
    )
    return jsonResponse({
      items: matching.slice(offset, offset + limit),
      total: matching.length,
      limit,
      offset,
    })
  })
  vi.stubGlobal('fetch', fetchFn)
  return fetchFn
}

function requestedUrls(fetchFn: ReturnType<typeof fakeApi>): URL[] {
  return fetchFn.mock.calls.map(([input]) => new URL(input))
}

function lastRequest(fetchFn: ReturnType<typeof fakeApi>): URL {
  return requestedUrls(fetchFn).at(-1)!
}

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/', element: <ApplicationsPage /> }], {
    initialEntries: [url],
  })
  // The tests run in French (jsdom's browser says en-US, which would change the language).
  render(
    <I18nextProvider i18n={createI18n(resources, 'fr')}>
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
  return { router, user: userEvent.setup() }
}

const ids = (count: number) => Array.from({ length: count }, (_, i) => i + 1)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ApplicationsPage', () => {
  describe('loading and display', () => {
    it('shows a loading message, then the applications', async () => {
      fakeApi([
        makeApplication(1, {
          company: 'Acme',
          position: 'Developer',
          status: 'INTERVIEW',
          location: 'Paris',
          deadline: '2026-11-20',
        }),
        makeApplication(2, { company: 'Globex' }),
      ])
      renderAt('/')

      expect(screen.getByText('Chargement des candidatures…')).toBeInTheDocument()

      const table = await screen.findByRole('table', { name: 'Liste des candidatures' })
      const acme = within(table).getByRole('row', { name: /Acme/ })
      expect(within(acme).getByRole('rowheader', { name: 'Acme' })).toBeInTheDocument()
      expect(within(acme).getByRole('cell', { name: 'Developer' })).toBeInTheDocument()
      expect(within(acme).getByRole('cell', { name: 'Entretien' })).toBeInTheDocument()
      expect(within(acme).getByRole('cell', { name: 'Paris' })).toBeInTheDocument()
      expect(within(acme).getByRole('cell', { name: '20/11/2026' })).toBeInTheDocument()
      // Missing location and deadline show a dash, not "null".
      const globex = within(table).getByRole('row', { name: /Globex/ })
      expect(within(globex).getAllByRole('cell', { name: '—' })).toHaveLength(2)
    })

    it('shows the error and lets the user retry', async () => {
      const fetchFn = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      vi.stubGlobal('fetch', fetchFn)
      const { user } = renderAt('/')

      const alert = await screen.findByRole('alert')
      // In French, with the translated reason, and not the English developer message.
      expect(alert).toHaveTextContent(
        'Impossible de charger les candidatures : Impossible de joindre le serveur. Est-il démarré ?',
      )
      expect(alert).not.toHaveTextContent('Cannot reach the API')

      fetchFn.mockResolvedValue(
        jsonResponse({ items: [makeApplication(1)], total: 1, limit: 20, offset: 0 }),
      )
      await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

      expect(await screen.findByRole('table')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('empty states', () => {
    it('says there is no application at all when there are none and no filter', async () => {
      fakeApi([])
      renderAt('/')
      expect(await screen.findByText("Aucune candidature pour l'instant.")).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
    })

    it('says no result matches when filters are active', async () => {
      fakeApi([makeApplication(1)]) // one APPLIED application, none OFFER
      renderAt('/?status=OFFER')
      expect(
        await screen.findByText('Aucune candidature ne correspond aux filtres actuels.'),
      ).toBeInTheDocument()
      expect(screen.queryByText("Aucune candidature pour l'instant.")).not.toBeInTheDocument()
    })

    it('says no result matches for a search with no hit', async () => {
      fakeApi([makeApplication(1)])
      renderAt('/?q=zzz')
      expect(
        await screen.findByText('Aucune candidature ne correspond aux filtres actuels.'),
      ).toBeInTheDocument()
    })
  })

  describe('filters in the URL', () => {
    it('filters by status: new history entry, page back to 1, API called with the status', async () => {
      const fetchFn = fakeApi([
        makeApplication(1, { company: 'Applied Co' }),
        makeApplication(2, { company: 'Offer Co', status: 'OFFER' }),
      ])
      const { router, user } = renderAt('/?page=2')
      await screen.findByText('Chargement des candidatures…')
      await waitFor(() => expect(screen.queryByText('Chargement des candidatures…')).toBeNull())

      await user.selectOptions(screen.getByRole('combobox', { name: 'Statut' }), 'Offre')

      expect(await screen.findByRole('rowheader', { name: 'Offer Co' })).toBeInTheDocument()
      expect(screen.queryByRole('rowheader', { name: 'Applied Co' })).not.toBeInTheDocument()
      expect(router.state.location.search).toBe('?status=OFFER')
      expect(router.state.historyAction).toBe('PUSH')
      expect(lastRequest(fetchFn).searchParams.get('status')).toBe('OFFER')
      expect(lastRequest(fetchFn).searchParams.get('offset')).toBe('0')
    })

    it('searches once after typing stops, and replaces the history entry', async () => {
      const fetchFn = fakeApi([
        makeApplication(1, { company: 'Acme' }),
        makeApplication(2, { company: 'Globex' }),
      ])
      const { router, user } = renderAt('/')
      await screen.findByRole('table')

      await user.type(screen.getByRole('searchbox', { name: /Rechercher/ }), 'acme')

      await waitFor(() => expect(router.state.location.search).toBe('?q=acme'))
      expect(await screen.findByRole('rowheader', { name: 'Acme' })).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.queryByRole('rowheader', { name: 'Globex' })).not.toBeInTheDocument(),
      )
      // REPLACE: the keystrokes did not pile up entries in the history.
      expect(router.state.historyAction).toBe('REPLACE')
      // Debounce: one search request, not one per letter (a, ac, acm, acme).
      const searches = requestedUrls(fetchFn).filter((url) => url.searchParams.has('q'))
      expect(searches).toHaveLength(1)
      expect(searches[0].searchParams.get('q')).toBe('acme')
    })

    it('shows in the field a search changed from outside (Back, edited URL)', async () => {
      fakeApi([makeApplication(1)])
      const { router } = renderAt('/')
      await screen.findByRole('table')

      await act(() => router.navigate('/?q=zzz'))

      expect(screen.getByRole('searchbox', { name: /Rechercher/ })).toHaveValue('zzz')
    })

    it('falls back to the defaults for invalid URL parameters', async () => {
      const fetchFn = fakeApi([makeApplication(1)])
      renderAt('/?page=abc&status=HIRED')

      await screen.findByRole('table')
      const request = lastRequest(fetchFn)
      expect(request.searchParams.get('offset')).toBe('0')
      expect(request.searchParams.has('status')).toBe(false)
      expect(screen.getByRole('combobox', { name: 'Statut' })).toHaveValue('')
    })
  })

  describe('pagination', () => {
    it('shows the page position and moves between pages with named buttons', async () => {
      const fetchFn = fakeApi(ids(45).map((id) => makeApplication(id)))
      const { router, user } = renderAt('/')

      const nav = await screen.findByRole('navigation', { name: 'Pagination' })
      expect(within(nav).getByText('Page 1 sur 3')).toBeInTheDocument()
      expect(within(nav).getByRole('button', { name: 'Page précédente' })).toBeDisabled()
      expect(screen.getAllByRole('row')).toHaveLength(21) // header + 20 rows

      await user.click(within(nav).getByRole('button', { name: 'Page suivante' }))

      expect(await within(nav).findByText('Page 2 sur 3')).toBeInTheDocument()
      expect(router.state.location.search).toBe('?page=2')
      expect(router.state.historyAction).toBe('PUSH')
      await waitFor(() => expect(lastRequest(fetchFn).searchParams.get('offset')).toBe('20'))
      expect(within(nav).getByRole('button', { name: 'Page précédente' })).toBeEnabled()
    })

    it('disables "next" on the last page, which has the remaining rows', async () => {
      fakeApi(ids(45).map((id) => makeApplication(id)))
      renderAt('/?page=3')

      const nav = await screen.findByRole('navigation', { name: 'Pagination' })
      expect(within(nav).getByText('Page 3 sur 3')).toBeInTheDocument()
      expect(within(nav).getByRole('button', { name: 'Page suivante' })).toBeDisabled()
      expect(screen.getAllByRole('row')).toHaveLength(6) // header + 5 rows
    })

    it('goes back to the last page when the URL asks for one past the end', async () => {
      const fetchFn = fakeApi(ids(45).map((id) => makeApplication(id)))
      const { router } = renderAt('/?page=9')

      await waitFor(() => expect(router.state.location.search).toBe('?page=3'))
      expect(router.state.historyAction).toBe('REPLACE')
      expect(await screen.findByText('Page 3 sur 3')).toBeInTheDocument()
      expect(lastRequest(fetchFn).searchParams.get('offset')).toBe('40')
    })
  })

  describe('reloading', () => {
    it('keeps the previous rows and shows a discreet indicator while reloading', async () => {
      const fetchFn = fakeApi([
        makeApplication(1, { company: 'Acme' }),
        makeApplication(2, { company: 'Offer Co', status: 'OFFER' }),
      ])
      const { user } = renderAt('/')
      await screen.findByRole('rowheader', { name: 'Acme' })

      // The next request stays unanswered until `release` is called.
      let release!: () => void
      fetchFn.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = () =>
              resolve(
                jsonResponse({
                  items: [makeApplication(2, { company: 'Offer Co', status: 'OFFER' })],
                  total: 1,
                  limit: 20,
                  offset: 0,
                }),
              )
          }),
      )
      await user.selectOptions(screen.getByRole('combobox', { name: 'Statut' }), 'Offre')

      expect(await screen.findByText('Mise à jour…')).toBeInTheDocument()
      // Previous data stays on screen: no blank flash, no "loading" message.
      expect(screen.getByRole('rowheader', { name: 'Acme' })).toBeInTheDocument()
      expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByText('Chargement des candidatures…')).not.toBeInTheDocument()

      await act(async () => release())

      await waitFor(() => expect(screen.queryByText('Mise à jour…')).not.toBeInTheDocument())
      expect(screen.queryByRole('rowheader', { name: 'Acme' })).not.toBeInTheDocument()
      expect(screen.getByRole('rowheader', { name: 'Offer Co' })).toBeInTheDocument()
      expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false')
    })
  })
})
