import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { Application } from '../api/applications'
import type { Contact } from '../api/contacts'
import { createI18n } from '../i18n/createI18n'
import type { Language } from '../i18n/languages'
import { resources } from '../i18n/resources'
import { createQueryClient } from '../queryClient'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ACME: Application = {
  id: 1,
  company: 'Acme',
  position: 'Developer',
  status: 'APPLIED',
  location: null,
  deadline: null,
  created_at: '2026-11-01T10:00:00Z',
}
const GLOBEX: Application = { ...ACME, id: 2, company: 'Globex' }

function contact(id: number): Contact {
  return {
    id,
    application_id: 1,
    name: `Contact ${id}`,
    contacted_at: null,
    replied_at: null,
    state: 'NOT_CONTACTED',
    created_at: '2026-11-01T09:00:00Z',
  }
}

type Options = {
  contactCount?: number
  contactsFail?: boolean
  // The first DELETE fails like this, the next ones work.
  firstDeleteFails?: 'network' | 'not_found'
  holdDelete?: boolean
}

function fakeBackend({
  contactCount = 0,
  contactsFail = false,
  firstDeleteFails,
  holdDelete = false,
}: Options = {}) {
  const applications = [{ ...ACME }, { ...GLOBEX }]
  const requests: { method: string; path: string }[] = []
  let failuresLeft = firstDeleteFails ? 1 : 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input)
      const method = init?.method ?? 'GET'
      requests.push({ method, path: url.pathname })

      if (url.pathname === '/applications' && method === 'GET') {
        return json({ items: applications, total: applications.length, limit: 20, offset: 0 })
      }
      if (url.pathname === '/applications/1/contacts') {
        if (contactsFail) throw new TypeError('Failed to fetch')
        return json(Array.from({ length: contactCount }, (_, i) => contact(i + 1)))
      }
      const match = /^\/applications\/(\d+)$/.exec(url.pathname)
      if (match) {
        const index = applications.findIndex((a) => a.id === Number(match[1]))
        if (method === 'DELETE') {
          if (holdDelete) await gate
          if (failuresLeft > 0) {
            failuresLeft -= 1
            if (firstDeleteFails === 'network') throw new TypeError('Failed to fetch')
            return json({ detail: 'Application not found' }, 404)
          }
          if (index < 0) return json({ detail: 'Application not found' }, 404)
          applications.splice(index, 1)
          return new Response(null, { status: 204 })
        }
        if (index < 0) return json({ detail: 'Application not found' }, 404)
        return json(applications[index])
      }
      return json({ detail: 'unexpected' }, 500)
    }),
  )

  const deletes = () => requests.filter((request) => request.method === 'DELETE')
  return { requests, deletes, release: () => release() }
}

function renderPage(language: Language = 'fr') {
  const router = createMemoryRouter([{ path: '*', element: <App /> }], {
    initialEntries: ['/applications/1'],
  })
  render(
    <I18nextProvider i18n={createI18n(resources, language)}>
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
  return { user: userEvent.setup(), router }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const deleteButton = () => screen.getByRole('button', { name: 'Supprimer' })

// The contacts must be loaded before the question is opened, or the text would say
// "if any" instead of the number.
async function openQuestion(user: ReturnType<typeof userEvent.setup>, contactsLoaded = true) {
  await screen.findByRole('heading', { level: 1, name: 'Acme' })
  if (contactsLoaded) {
    await waitFor(() => {
      expect(screen.queryByText('Chargement des contacts…')).not.toBeInTheDocument()
    })
  }
  await user.click(deleteButton())
  return screen.getByRole('group', { name: 'Supprimer cette candidature ?' })
}

describe('deleting an application', () => {
  it('asks first: nothing is deleted just by showing the page or the question', async () => {
    const backend = fakeBackend()
    const { user } = renderPage()
    await openQuestion(user)
    expect(backend.deletes()).toHaveLength(0)
  })

  it('puts the keyboard on Cancel, the safe choice, not on the destructive button', async () => {
    fakeBackend()
    const { user } = renderPage()
    await openQuestion(user)
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })

  it.each([
    [0, '« Acme » sera supprimée définitivement.'],
    [1, '« Acme » et son contact seront supprimés définitivement.'],
    [3, '« Acme » et ses 3 contacts seront supprimés définitivement.'],
  ])('says what will be lost with %i contact(s)', async (count, sentence) => {
    fakeBackend({ contactCount: count })
    const { user } = renderPage()
    const question = await openQuestion(user)
    expect(question).toHaveAccessibleDescription(sentence)
  })

  it('does not invent a number when the contacts could not be loaded', async () => {
    fakeBackend({ contactsFail: true })
    const { user } = renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Acme' })
    await screen.findByText(/Impossible de charger les contacts/)
    await user.click(deleteButton())
    expect(screen.getByRole('group', { name: 'Supprimer cette candidature ?' })).toHaveAccessibleDescription(
      '« Acme » et ses contacts éventuels seront supprimés définitivement.',
    )
  })

  it('closes on Cancel, sends nothing and gives the focus back to the Delete button', async () => {
    const backend = fakeBackend()
    const { user } = renderPage()
    await openQuestion(user)

    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('group', { name: 'Supprimer cette candidature ?' })).not.toBeInTheDocument()
    expect(deleteButton()).toHaveFocus()
    expect(backend.deletes()).toHaveLength(0)
  })

  it('closes on the Escape key too', async () => {
    const backend = fakeBackend()
    const { user } = renderPage()
    await openQuestion(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('group', { name: 'Supprimer cette candidature ?' })).not.toBeInTheDocument()
    expect(backend.deletes()).toHaveLength(0)
  })

  it('deletes after the confirmation, goes back to the list and says so', async () => {
    const backend = fakeBackend({ contactCount: 2 })
    const { user } = renderPage()
    await openQuestion(user)

    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))

    expect(await screen.findByRole('heading', { name: 'Candidatures' })).toBeInTheDocument()
    expect(await screen.findByText('Candidature supprimée.')).toBeInTheDocument()
    expect(backend.deletes()).toEqual([{ method: 'DELETE', path: '/applications/1' }])
    // The list was read again: Acme is gone, Globex remains.
    const table = await screen.findByRole('table', { name: 'Liste des candidatures' })
    expect(table).toHaveTextContent('Globex')
    expect(table).not.toHaveTextContent('Acme')
  })

  it('does not ask the API for the deleted application again (that would be a 404)', async () => {
    const backend = fakeBackend()
    const { user } = renderPage()
    await openQuestion(user)
    const before = backend.requests.length

    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))
    await screen.findByText('Candidature supprimée.')

    const after = backend.requests.slice(before)
    expect(after.filter((r) => r.path === '/applications/1' && r.method === 'GET')).toHaveLength(0)
    expect(after.filter((r) => r.path === '/applications/1/contacts')).toHaveLength(0)
  })

  it('does not show the deleted application from the cache when its address is opened again', async () => {
    fakeBackend()
    const { user, router } = renderPage()
    await openQuestion(user)
    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))
    await screen.findByText('Candidature supprimée.')

    await act(() => router.navigate('/applications/1'))

    // Not even for a moment: the cached copy was forgotten with the deletion.
    expect(screen.queryByRole('heading', { level: 1, name: 'Acme' })).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent("Cette candidature n'existe pas.")
  })

  it('sends one request only when the confirmation is clicked twice', async () => {
    const backend = fakeBackend({ holdDelete: true })
    const { user } = renderPage()
    await openQuestion(user)

    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))
    expect(screen.getByRole('button', { name: 'Suppression…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Suppression…' }))
    backend.release()

    await screen.findByText('Candidature supprimée.')
    expect(backend.deletes()).toHaveLength(1)
  })

  it('shows a translated error, stays on the page, and lets the user try again', async () => {
    const backend = fakeBackend({ firstDeleteFails: 'network' })
    const { user } = renderPage()
    await openQuestion(user)

    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de supprimer la candidature')
    expect(alert).toHaveTextContent('Impossible de joindre le serveur')
    expect(alert).not.toHaveTextContent('Cannot reach the API')
    expect(alert).toHaveFocus()
    expect(screen.getByRole('heading', { level: 1, name: 'Acme' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))
    expect(await screen.findByText('Candidature supprimée.')).toBeInTheDocument()
    expect(backend.deletes()).toHaveLength(2)
  })

  it('says it was not found when the application was already deleted elsewhere (404)', async () => {
    fakeBackend({ firstDeleteFails: 'not_found' })
    const { user } = renderPage()
    await openQuestion(user)
    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Introuvable.')
  })

  it('works in English', async () => {
    fakeBackend({ contactCount: 3 })
    const { user } = renderPage('en')
    await screen.findByRole('heading', { level: 1, name: 'Acme' })
    await waitFor(() => expect(screen.queryByText('Loading the contacts…')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('group', { name: 'Delete this application?' })).toHaveAccessibleDescription(
      '"Acme" and its 3 contacts will be permanently deleted.',
    )
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(await screen.findByText('Application deleted.')).toBeInTheDocument()
  })
})
