import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  status: 'INTERVIEW',
  location: 'Paris',
  deadline: '2026-11-20',
  created_at: '2026-11-01T10:00:00Z',
}

function contact(id: number, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    application_id: 1,
    name: `Contact ${id}`,
    contacted_at: null,
    replied_at: null,
    state: 'NOT_CONTACTED',
    created_at: '2026-11-01T09:00:00Z',
    ...overrides,
  }
}

type Fake = { contacts?: Contact[]; contactsFailFirst?: boolean }

// A tiny fake backend: the list, one application, and its contacts.
function fakeBackend({ contacts = [], contactsFailFirst = false }: Fake = {}) {
  let failures = contactsFailFirst ? 1 : 0
  const requested: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input)
      requested.push(url.pathname)
      if (url.pathname === '/applications') {
        return json({ items: [ACME], total: 1, limit: 20, offset: 0 })
      }
      if (url.pathname === '/applications/1') return json(ACME)
      if (url.pathname === '/applications/1/contacts') {
        if (failures > 0) {
          failures -= 1
          throw new TypeError('Failed to fetch')
        }
        return json(contacts)
      }
      return json({ detail: 'Application not found' }, 404)
    }),
  )
  return { requested }
}

function renderAt(url: string, language: Language = 'fr') {
  const router = createMemoryRouter([{ path: '*', element: <App /> }], { initialEntries: [url] })
  render(
    <I18nextProvider i18n={createI18n(resources, language)}>
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  // Contact dates are shown in the local timezone: fixed here, so that the expected
  // times do not depend on the machine running the tests.
  vi.stubEnv('TZ', 'Europe/Paris')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('application detail page', () => {
  it('opens from the company name in the list and shows the application', async () => {
    fakeBackend()
    const user = renderAt('/')

    await user.click(await screen.findByRole('link', { name: 'Acme' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Acme' })).toBeInTheDocument()
    const details = screen.getByText('Poste').closest('dl')!
    expect(within(details).getByText('Developer')).toBeInTheDocument()
    expect(within(details).getByText('Entretien')).toBeInTheDocument()
    expect(within(details).getByText('Paris')).toBeInTheDocument()
    expect(within(details).getByText('20 nov. 2026')).toBeInTheDocument()
  })

  it('shows the contacts with their state and their dates', async () => {
    fakeBackend({
      contacts: [
        contact(1, { name: 'Alice', state: 'NOT_CONTACTED' }),
        contact(2, {
          name: 'Bob',
          state: 'REPLIED',
          contacted_at: '2026-11-10T10:00:00Z',
          replied_at: '2026-11-12T14:30:00Z',
        }),
      ],
    })
    renderAt('/applications/1')

    const table = await screen.findByRole('table', { name: 'Contacts de la candidature' })
    const alice = within(table).getByRole('row', { name: /Alice/ })
    expect(within(alice).getByRole('cell', { name: 'Pas encore contacté' })).toBeInTheDocument()
    expect(within(alice).getAllByRole('cell', { name: '—' })).toHaveLength(2)

    const bob = within(table).getByRole('row', { name: /Bob/ })
    expect(within(bob).getByRole('cell', { name: 'A répondu' })).toBeInTheDocument()
    // 10:00 UTC is 11:00 in Paris in November; 14:30 UTC is 15:30.
    expect(within(bob).getByRole('cell', { name: /10 nov\. 2026.*11:00/ })).toBeInTheDocument()
    expect(within(bob).getByRole('cell', { name: /12 nov\. 2026.*15:30/ })).toBeInTheDocument()
  })

  it('says so when there is no contact', async () => {
    fakeBackend({ contacts: [] })
    renderAt('/applications/1')
    expect(await screen.findByText('Aucun contact pour cette candidature.')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Contacts de la candidature' })).not.toBeInTheDocument()
  })

  it('switches the whole page to English without reloading', async () => {
    fakeBackend({
      contacts: [contact(2, { name: 'Bob', state: 'WAITING', contacted_at: '2026-11-10T10:00:00Z' })],
    })
    const user = renderAt('/applications/1')
    await screen.findByRole('table', { name: 'Contacts de la candidature' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Langue / Language' }), 'English')

    const table = screen.getByRole('table', { name: 'Contacts of the application' })
    expect(within(table).getByRole('cell', { name: 'Waiting for a reply' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: /Nov 10, 2026.*11:00/ })).toBeInTheDocument()
    expect(screen.getByText('Position')).toBeInTheDocument()
    expect(screen.getByText('Nov 20, 2026')).toBeInTheDocument()
  })

  it('keeps the application visible when only the contacts fail, and retries', async () => {
    fakeBackend({ contacts: [contact(1, { name: 'Alice' })], contactsFailFirst: true })
    const user = renderAt('/applications/1')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les contacts')
    expect(alert).toHaveTextContent('Impossible de joindre le serveur')
    expect(screen.getByRole('heading', { level: 1, name: 'Acme' })).toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('table', { name: 'Contacts de la candidature' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says the application does not exist, without asking for its contacts', async () => {
    const backend = fakeBackend()
    renderAt('/applications/999')
    expect(await screen.findByRole('alert')).toHaveTextContent("Cette candidature n'existe pas.")
    expect(backend.requested).not.toContain('/applications/999/contacts')
  })

  it('does not ask the API for an id that is not a number', async () => {
    const backend = fakeBackend()
    renderAt('/applications/abc')
    expect(await screen.findByRole('alert')).toHaveTextContent("Cette candidature n'existe pas.")
    expect(backend.requested).toHaveLength(0)
  })

  it('leads to the edit form and back to the list', async () => {
    fakeBackend()
    const user = renderAt('/applications/1')

    await user.click(await screen.findByRole('link', { name: 'Modifier' }))
    expect(await screen.findByRole('heading', { name: 'Modifier la candidature' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Entreprise/ })).toHaveValue('Acme')
  })

  it('goes back to the list', async () => {
    fakeBackend()
    const user = renderAt('/applications/1')
    // The "loading" screen has the same link: wait for the real page, or the click would
    // land on a link that is replaced a moment later.
    await screen.findByRole('heading', { level: 1, name: 'Acme' })
    await user.click(screen.getByRole('link', { name: 'Retour à la liste' }))
    expect(await screen.findByRole('heading', { name: 'Candidatures' })).toBeInTheDocument()
  })
})
