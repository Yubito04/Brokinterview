import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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

// The contact screens, tested through the whole App against a small fake backend that
// applies the same rules as the real one (name length, the two date rules) and
// remembers what it was sent.

const ACME: Application = {
  id: 1,
  company: 'Acme',
  position: 'Developer',
  status: 'APPLIED',
  location: null,
  deadline: null,
  created_at: '2026-11-01T10:00:00Z',
}

function json(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stateOf(contact: Pick<Contact, 'contacted_at' | 'replied_at'>): Contact['state'] {
  if (contact.replied_at) return 'REPLIED'
  return contact.contacted_at ? 'WAITING' : 'NOT_CONTACTED'
}

function makeContact(id: number, overrides: Partial<Contact> = {}): Contact {
  const base = {
    id,
    application_id: 1,
    name: `Contact ${id}`,
    contacted_at: null,
    replied_at: null,
    created_at: '2026-11-01T09:00:00Z',
    ...overrides,
  }
  return { ...base, state: stateOf(base) }
}

type Sent = { method: string; path: string; body?: Record<string, unknown> }

type Options = {
  contacts?: Contact[]
  // How a DELETE fails, if it does.
  deleteFails?: 'network' | 'not_found'
  // Writes wait until release() is called (no timer: the test decides how long).
  holdWrites?: boolean
}

function fakeBackend({ contacts = [], deleteFails, holdWrites = false }: Options = {}) {
  const store = contacts.map((contact) => ({ ...contact }))
  const sent: Sent[] = []
  let nextId = 100
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  // The two rules of the real backend, with its error codes and without any `ctx`.
  function dateIssue(contacted: string | null, replied: string | null) {
    if (!replied) return undefined
    if (!contacted) return 'reply_without_contact'
    return new Date(replied) < new Date(contacted) ? 'reply_before_contact' : undefined
  }
  const issue = (type: string, field: string, ctx?: Record<string, unknown>) => ({
    type,
    loc: ['body', field],
    msg: 'English message',
    ...(ctx ? { ctx } : {}),
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input)
      const method = init?.method ?? 'GET'
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined
      sent.push({ method, path: url.pathname, body })

      if (method !== 'GET' && holdWrites) await gate

      if (url.pathname === '/applications/1') return json(ACME)
      if (url.pathname === '/applications/1/contacts' && method === 'GET') return json(store)
      if (url.pathname === '/applications/1/contacts' && method === 'POST') {
        if (body!.name === '') return json({ detail: [issue('string_too_short', 'name', { min_length: 1 })] }, 422)
        const code = dateIssue((body!.contacted_at as string) ?? null, (body!.replied_at as string) ?? null)
        if (code) return json({ detail: [issue(code, 'replied_at')] }, 422)
        const created = makeContact(nextId++, {
          name: body!.name as string,
          contacted_at: (body!.contacted_at as string) ?? null,
          replied_at: (body!.replied_at as string) ?? null,
        })
        store.push(created)
        return json(created, 201)
      }
      const match = /^\/contacts\/(\d+)$/.exec(url.pathname)
      if (match) {
        const index = store.findIndex((contact) => contact.id === Number(match[1]))
        if (method === 'DELETE') {
          if (deleteFails === 'network') throw new TypeError('Failed to fetch')
          if (deleteFails === 'not_found' || index < 0) {
            if (index >= 0) store.splice(index, 1) // someone else deleted it: gone for real
            return json({ detail: 'Contact not found' }, 404)
          }
          store.splice(index, 1)
          return new Response(null, { status: 204 })
        }
        if (index < 0) return json({ detail: 'Contact not found' }, 404)
        if (method === 'PATCH') {
          const merged = { ...store[index], ...body }
          if (body!.name === '') return json({ detail: [issue('string_too_short', 'name', { min_length: 1 })] }, 422)
          const code = dateIssue(merged.contacted_at, merged.replied_at)
          if (code && ('contacted_at' in body! || 'replied_at' in body!)) {
            return json({ detail: [issue(code, 'replied_at')] }, 422)
          }
          store[index] = { ...merged, state: stateOf(merged) }
          return json(store[index])
        }
      }
      return json({ detail: 'unexpected' }, 500)
    }),
  )

  const writes = () => sent.filter((request) => request.method !== 'GET')
  return { store, sent, writes, release: () => release() }
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
  return userEvent.setup()
}

beforeEach(() => {
  vi.stubEnv('TZ', 'Europe/Paris')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const ALICE = makeContact(1, {
  name: 'Alice',
  contacted_at: '2026-11-10T10:00:00Z',
})

const addButton = () => screen.getByRole('button', { name: 'Ajouter un contact' })
const liveRegion = () => within(screen.getByRole('region', { name: 'Contacts' })).getByRole('status')

describe('adding a contact', () => {
  it('opens a form, saves, shows the new row and announces it', async () => {
    const backend = fakeBackend({ contacts: [ALICE] })
    const user = renderPage()
    await screen.findByRole('rowheader', { name: 'Alice' })

    // The live region exists and is empty BEFORE the action (so that its change is announced).
    expect(liveRegion()).toHaveTextContent('')

    await user.click(addButton())
    expect(screen.getByRole('heading', { name: 'Nouveau contact' })).toBeInTheDocument()
    // The keyboard goes to the first field of the form that just opened.
    expect(screen.getByRole('textbox', { name: /Nom/ })).toHaveFocus()

    await user.type(screen.getByRole('textbox', { name: /Nom/ }), ' Bob ')
    await user.type(screen.getByLabelText('Contacté le'), '2026-11-12T09:30')
    await user.click(screen.getByRole('button', { name: 'Ajouter le contact' }))

    expect(await screen.findByRole('rowheader', { name: 'Bob' })).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('Contact ajouté.')
    expect(screen.queryByRole('heading', { name: 'Nouveau contact' })).not.toBeInTheDocument()
    // The form closed: the keyboard comes back to the button that opened it.
    expect(addButton()).toHaveFocus()
    // 09:30 in Paris (UTC+1 in November) is 08:30 UTC.
    expect(backend.writes()).toEqual([
      {
        method: 'POST',
        path: '/applications/1/contacts',
        body: { name: 'Bob', contacted_at: '2026-11-12T08:30:00.000Z' },
      },
    ])
  })

  it('shows an empty name under the field, in French, and keeps what was typed', async () => {
    fakeBackend()
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Ajouter un contact' }))

    await user.type(screen.getByLabelText('Contacté le'), '2026-11-12T09:30')
    await user.click(screen.getByRole('button', { name: 'Ajouter le contact' }))

    const name = screen.getByRole('textbox', { name: /Nom/ })
    await waitFor(() => expect(name).toBeInvalid())
    expect(name).toHaveAccessibleDescription('Trop court (minimum : 1).')
    expect(name).toHaveFocus()
    expect(screen.getByLabelText('Contacté le')).toHaveValue('2026-11-12T09:30')
  })

  it('shows a reply before the contact under the reply field', async () => {
    fakeBackend()
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Ajouter un contact' }))

    await user.type(screen.getByRole('textbox', { name: /Nom/ }), 'Bob')
    await user.type(screen.getByLabelText('Contacté le'), '2026-11-12T09:30')
    await user.type(screen.getByLabelText('Réponse le'), '2026-11-11T09:30')
    await user.click(screen.getByRole('button', { name: 'Ajouter le contact' }))

    const replied = screen.getByLabelText('Réponse le')
    await waitFor(() => expect(replied).toBeInvalid())
    expect(replied).toHaveAccessibleDescription('La réponse ne peut pas précéder le contact.')
    expect(replied).toHaveFocus()
  })

  it('shows a reply without a contact date, in English when the interface is in English', async () => {
    fakeBackend()
    const user = renderPage('en')
    await user.click(await screen.findByRole('button', { name: 'Add a contact' }))

    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Bob')
    await user.type(screen.getByLabelText('Replied on'), '2026-11-11T09:30')
    await user.click(screen.getByRole('button', { name: 'Add contact' }))

    const replied = screen.getByLabelText('Replied on')
    await waitFor(() => expect(replied).toBeInvalid())
    expect(replied).toHaveAccessibleDescription('A reply needs a contact date.')
  })

  it('sends one request only when the button is clicked twice', async () => {
    const backend = fakeBackend({ holdWrites: true })
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Ajouter un contact' }))
    await user.type(screen.getByRole('textbox', { name: /Nom/ }), 'Bob')

    await user.click(screen.getByRole('button', { name: 'Ajouter le contact' }))
    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Enregistrement…' }))
    backend.release()

    expect(await screen.findByRole('rowheader', { name: 'Bob' })).toBeInTheDocument()
    expect(backend.writes()).toHaveLength(1)
  })

  it('closes the form without sending anything when cancelled', async () => {
    const backend = fakeBackend()
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Ajouter un contact' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('heading', { name: 'Nouveau contact' })).not.toBeInTheDocument()
    expect(backend.writes()).toHaveLength(0)
  })
})

describe('editing a contact', () => {
  it('is prefilled, sends only what changed, and announces it', async () => {
    const backend = fakeBackend({ contacts: [ALICE] })
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Modifier Alice' }))
    expect(screen.getByRole('heading', { name: 'Modifier le contact' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Nom/ })).toHaveValue('Alice')
    // 10:00 UTC shown as 11:00 in Paris.
    expect(screen.getByLabelText('Contacté le')).toHaveValue('2026-11-10T11:00')
    expect(screen.getByLabelText('Réponse le')).toHaveValue('')

    await user.clear(screen.getByRole('textbox', { name: /Nom/ }))
    await user.type(screen.getByRole('textbox', { name: /Nom/ }), 'Alicia')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }))

    expect(await screen.findByRole('rowheader', { name: 'Alicia' })).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('Contact modifié.')
    expect(backend.writes()).toEqual([
      { method: 'PATCH', path: '/contacts/1', body: { name: 'Alicia' } },
    ])
  })

  it('sends null to clear a date that was emptied', async () => {
    const backend = fakeBackend({ contacts: [ALICE] })
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Modifier Alice' }))
    await user.clear(screen.getByLabelText('Contacté le'))
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }))
    await waitFor(() => expect(backend.writes()).toHaveLength(1))
    expect(backend.writes()[0].body).toEqual({ contacted_at: null })
  })

  it('sends nothing and says nothing when nothing changed', async () => {
    const backend = fakeBackend({ contacts: [ALICE] })
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Modifier Alice' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }))

    expect(screen.queryByRole('heading', { name: 'Modifier le contact' })).not.toBeInTheDocument()
    expect(backend.writes()).toHaveLength(0)
    expect(liveRegion()).toHaveTextContent('')
  })

  it('shows a refused change under the field and keeps the form open', async () => {
    fakeBackend({ contacts: [ALICE] })
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Modifier Alice' }))
    await user.type(screen.getByLabelText('Réponse le'), '2026-11-09T10:00')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }))

    const replied = screen.getByLabelText('Réponse le')
    await waitFor(() => expect(replied).toBeInvalid())
    expect(replied).toHaveAccessibleDescription('La réponse ne peut pas précéder le contact.')
    expect(screen.getByRole('heading', { name: 'Modifier le contact' })).toBeInTheDocument()
  })

  it('does not keep what was typed for one contact when another one is opened', async () => {
    fakeBackend({ contacts: [ALICE, makeContact(2, { name: 'Bob' })] })
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Modifier Alice' }))
    await user.type(screen.getByRole('textbox', { name: /Nom/ }), ' typed for Alice')

    await user.click(screen.getByRole('button', { name: 'Modifier Bob' }))

    expect(screen.getByRole('textbox', { name: /Nom/ })).toHaveValue('Bob')
  })
})

describe('deleting a contact', () => {
  it('removes the row, announces it and puts the keyboard on a stable button', async () => {
    const backend = fakeBackend({ contacts: [ALICE, makeContact(2, { name: 'Bob' })] })
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer Alice' }))

    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Alice' })).not.toBeInTheDocument())
    expect(screen.getByRole('rowheader', { name: 'Bob' })).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('Contact supprimé.')
    expect(addButton()).toHaveFocus()
    expect(backend.writes()).toEqual([{ method: 'DELETE', path: '/contacts/1', body: undefined }])
  })

  it('names the contact in each action button, so that two rows are told apart', async () => {
    fakeBackend({ contacts: [ALICE, makeContact(2, { name: 'Bob' })] })
    renderPage()
    expect(await screen.findByRole('button', { name: 'Supprimer Alice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer Bob' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier Bob' })).toBeInTheDocument()
  })

  it('keeps the row and shows a translated error when the server cannot be reached', async () => {
    fakeBackend({ contacts: [ALICE], deleteFails: 'network' })
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer Alice' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de supprimer le contact')
    expect(alert).toHaveTextContent('Impossible de joindre le serveur')
    expect(alert).not.toHaveTextContent('Cannot reach the API')
    expect(screen.getByRole('rowheader', { name: 'Alice' })).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('')
  })

  it('reads the list again when the contact was already deleted elsewhere (404)', async () => {
    fakeBackend({ contacts: [ALICE, makeContact(2, { name: 'Bob' })], deleteFails: 'not_found' })
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer Alice' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Introuvable.')
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Alice' })).not.toBeInTheDocument())
    expect(screen.getByRole('rowheader', { name: 'Bob' })).toBeInTheDocument()
  })
})
