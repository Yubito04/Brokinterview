import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { Application } from '../api/applications'
import { createI18n } from '../i18n/createI18n'
import type { Language } from '../i18n/languages'
import { resources } from '../i18n/resources'
import { createQueryClient } from '../queryClient'

// The form screens are tested through the whole App (routes, list, forms), against a
// small fake backend that remembers what it was sent, like the real one would.

type Sent = { method: string; path: string; body?: Record<string, unknown> }

function json(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function issue(type: string, field: string, ctx: Record<string, unknown> = {}) {
  return { type, loc: ['body', field], msg: 'English message', ctx }
}

type FakeOptions = {
  initial?: Application[]
  // Writes wait until the test calls release(): the "saving" state lasts exactly as
  // long as the test needs, whatever the speed of the machine (no timer to race).
  holdWrites?: boolean
  // Makes every write fail like the network.
  writesFailWithNetworkError?: boolean
  // Extra 422 issues for the next write.
  extraIssues?: ReturnType<typeof issue>[]
}

function fakeBackend({
  initial = [],
  holdWrites = false,
  writesFailWithNetworkError = false,
  extraIssues = [],
}: FakeOptions = {}) {
  const store = [...initial]
  const sent: Sent[] = []
  let nextId = 100
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  function validate(body: Record<string, unknown>, partial: boolean) {
    const issues = [...extraIssues]
    for (const field of ['company', 'position']) {
      if (partial && !(field in body)) continue
      if (body[field] === '') issues.push(issue('string_too_short', field, { min_length: 1 }))
    }
    return issues
  }

  const fetchFn = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input)
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined
    sent.push({ method, path: url.pathname, body })

    if (method !== 'GET') {
      if (writesFailWithNetworkError) throw new TypeError('Failed to fetch')
      if (holdWrites) await gate
    }

    if (url.pathname === '/applications' && method === 'GET') {
      return json({ items: store, total: store.length, limit: 20, offset: 0 })
    }
    if (url.pathname === '/applications' && method === 'POST') {
      const issues = validate(body!, false)
      if (issues.length) return json({ detail: issues }, 422)
      const created: Application = {
        id: nextId++,
        company: body!.company as string,
        position: body!.position as string,
        status: (body!.status as Application['status']) ?? 'APPLIED',
        location: (body!.location as string | undefined) ?? null,
        deadline: (body!.deadline as string | undefined) ?? null,
        created_at: '2026-11-16T10:00:00Z',
      }
      store.unshift(created)
      return json(created, 201)
    }
    const match = /^\/applications\/(\d+)$/.exec(url.pathname)
    if (match) {
      const found = store.find((a) => a.id === Number(match[1]))
      if (!found) return json({ detail: 'Application not found' }, 404)
      if (method === 'GET') return json(found)
      if (method === 'PATCH') {
        const issues = validate(body!, true)
        if (issues.length) return json({ detail: issues }, 422)
        Object.assign(found, body)
        return json(found)
      }
    }
    return json({ detail: 'unexpected' }, 500)
  })
  vi.stubGlobal('fetch', fetchFn)

  const writes = () => sent.filter((request) => request.method !== 'GET')
  return { store, sent, writes, release: () => release() }
}

const ACME: Application = {
  id: 1,
  company: 'Acme',
  position: 'Developer',
  status: 'APPLIED',
  location: 'Paris',
  deadline: '2026-11-20',
  created_at: '2026-11-01T10:00:00Z',
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
  return { router, user: userEvent.setup() }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const field = (name: RegExp | string) => screen.getByRole('textbox', { name })

describe('create form', () => {
  it('opens from the list, creates the application and comes back with a confirmation', async () => {
    const backend = fakeBackend({ initial: [ACME] })
    const { user } = renderAt('/')

    await user.click(await screen.findByRole('link', { name: 'Nouvelle candidature' }))
    expect(screen.getByRole('heading', { name: 'Nouvelle candidature' })).toBeInTheDocument()

    await user.type(field(/Entreprise/), '  Globex ')
    await user.type(field(/Poste/), 'Engineer')
    await user.selectOptions(screen.getByRole('combobox', { name: /Statut/ }), 'Entretien')
    await user.type(field('Lieu'), 'Lyon')
    await user.type(screen.getByLabelText('Date limite'), '2026-12-01')
    await user.click(screen.getByRole('button', { name: 'Créer la candidature' }))

    // Back on the list: the confirmation, and the new row (the list was refreshed).
    expect(await screen.findByText('Candidature créée.')).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Liste des candidatures' })
    expect(within(table).getByRole('rowheader', { name: 'Globex' })).toBeInTheDocument()
    expect(backend.writes()).toEqual([
      {
        method: 'POST',
        path: '/applications',
        body: {
          company: 'Globex',
          position: 'Engineer',
          status: 'INTERVIEW',
          location: 'Lyon',
          deadline: '2026-12-01',
        },
      },
    ])
  })

  it('has no native validation: the browser bubbles are off', () => {
    fakeBackend()
    renderAt('/applications/new')
    const form = document.querySelector('form')
    expect(form).not.toBeNull()
    expect(form!.noValidate).toBe(true)
    // And no field uses the native `required`.
    expect(document.querySelectorAll('[required]')).toHaveLength(0)
  })

  it('shows the 422 errors under each field, translated, and keeps what was typed', async () => {
    const backend = fakeBackend()
    const { user } = renderAt('/applications/new')

    await user.type(field('Lieu'), 'Lyon')
    await user.click(screen.getByRole('button', { name: 'Créer la candidature' }))

    const company = await screen.findByRole('textbox', { name: /Entreprise/ })
    await waitFor(() => expect(company).toBeInvalid())
    expect(company).toHaveAccessibleDescription('Trop court (minimum : 1).')
    expect(field(/Poste/)).toHaveAccessibleDescription('Trop court (minimum : 1).')
    // English message of the server is never shown.
    expect(screen.queryByText('English message')).not.toBeInTheDocument()
    // What the user typed is still there, and no navigation happened.
    expect(field('Lieu')).toHaveValue('Lyon')
    expect(screen.getByRole('heading', { name: 'Nouvelle candidature' })).toBeInTheDocument()
    // The keyboard goes to the first invalid field.
    expect(company).toHaveFocus()
    expect(backend.writes()).toHaveLength(1)

    // Fix and send again: it works.
    await user.type(company, 'Globex')
    await user.type(field(/Poste/), 'Engineer')
    await user.click(screen.getByRole('button', { name: 'Créer la candidature' }))
    expect(await screen.findByText('Candidature créée.')).toBeInTheDocument()
    expect(backend.writes()).toHaveLength(2)
  })

  it('shows the same errors in English when the interface is in English', async () => {
    fakeBackend()
    const { user } = renderAt('/applications/new', 'en')
    await user.click(screen.getByRole('button', { name: 'Create application' }))
    expect(await screen.findByRole('textbox', { name: /Company/ })).toHaveAccessibleDescription(
      'Too short (minimum: 1).',
    )
  })

  it('sends only one request when the button is clicked twice', async () => {
    const backend = fakeBackend({ holdWrites: true })
    const { user } = renderAt('/applications/new')
    await user.type(field(/Entreprise/), 'Globex')
    await user.type(field(/Poste/), 'Engineer')

    const button = screen.getByRole('button', { name: 'Créer la candidature' })
    await user.click(button)
    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Enregistrement…' }))
    // Only now does the server answer.
    backend.release()

    expect(await screen.findByText('Candidature créée.')).toBeInTheDocument()
    expect(backend.writes()).toHaveLength(1)
  })

  it('shows a network failure above the form, translated, without losing the input', async () => {
    fakeBackend({ writesFailWithNetworkError: true })
    const { user } = renderAt('/applications/new')
    await user.type(field(/Entreprise/), 'Globex')
    await user.type(field(/Poste/), 'Engineer')
    await user.click(screen.getByRole('button', { name: 'Créer la candidature' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("La candidature n'a pas été enregistrée")
    expect(alert).toHaveTextContent('Impossible de joindre le serveur')
    expect(alert).not.toHaveTextContent('Cannot reach the API')
    expect(alert).toHaveFocus()
    expect(field(/Entreprise/)).toHaveValue('Globex')
    // The button is usable again to retry.
    expect(screen.getByRole('button', { name: 'Créer la candidature' })).toBeEnabled()
  })

  it('shows an issue about a field the form does not have in the summary', async () => {
    fakeBackend({ extraIssues: [issue('missing', 'salary')] })
    const { user } = renderAt('/applications/new')
    await user.type(field(/Entreprise/), 'Globex')
    await user.type(field(/Poste/), 'Engineer')
    await user.click(screen.getByRole('button', { name: 'Créer la candidature' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce champ est obligatoire.')
  })

  it('goes back to the list without sending anything when cancelled', async () => {
    const backend = fakeBackend({ initial: [ACME] })
    const { user } = renderAt('/applications/new')
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(await screen.findByRole('heading', { name: 'Candidatures' })).toBeInTheDocument()
    expect(backend.writes()).toHaveLength(0)
  })
})

describe('edit form', () => {
  it('opens from the row link, prefilled, and sends only what changed', async () => {
    const backend = fakeBackend({ initial: [ACME] })
    const { user } = renderAt('/')

    await user.click(await screen.findByRole('link', { name: 'Modifier Acme' }))
    expect(await screen.findByRole('heading', { name: 'Modifier la candidature' })).toBeInTheDocument()
    expect(field(/Entreprise/)).toHaveValue('Acme')
    expect(field(/Poste/)).toHaveValue('Developer')
    expect(screen.getByRole('combobox', { name: /Statut/ })).toHaveValue('APPLIED')
    expect(field('Lieu')).toHaveValue('Paris')
    expect(screen.getByLabelText('Date limite')).toHaveValue('2026-11-20')

    await user.selectOptions(screen.getByRole('combobox', { name: /Statut/ }), 'Offre')
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByText('Candidature modifiée.')).toBeInTheDocument()
    expect(backend.writes()).toEqual([
      { method: 'PATCH', path: '/applications/1', body: { status: 'OFFER' } },
    ])
    const table = await screen.findByRole('table', { name: 'Liste des candidatures' })
    expect(within(table).getByRole('cell', { name: 'Offre' })).toBeInTheDocument()
  })

  it('sends null for an optional field that was emptied', async () => {
    const backend = fakeBackend({ initial: [ACME] })
    const { user } = renderAt('/applications/1/edit')
    await user.clear(await screen.findByRole('textbox', { name: 'Lieu' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))
    expect(await screen.findByText('Candidature modifiée.')).toBeInTheDocument()
    expect(backend.writes()[0].body).toEqual({ location: null })
  })

  it('sends no request and shows no confirmation when nothing changed', async () => {
    const backend = fakeBackend({ initial: [ACME] })
    const { user } = renderAt('/applications/1/edit')
    await user.click(await screen.findByRole('button', { name: 'Enregistrer les modifications' }))
    expect(await screen.findByRole('heading', { name: 'Candidatures' })).toBeInTheDocument()
    expect(backend.writes()).toHaveLength(0)
    expect(screen.queryByText('Candidature modifiée.')).not.toBeInTheDocument()
  })

  it('shows a 422 under the field when a required field is emptied', async () => {
    fakeBackend({ initial: [ACME] })
    const { user } = renderAt('/applications/1/edit')
    const company = await screen.findByRole('textbox', { name: /Entreprise/ })
    await user.clear(company)
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))
    await waitFor(() => expect(company).toBeInvalid())
    expect(company).toHaveAccessibleDescription('Trop court (minimum : 1).')
    expect(company).toHaveFocus()
  })

  it('says the application does not exist on a 404', async () => {
    fakeBackend({ initial: [ACME] })
    renderAt('/applications/999/edit')
    expect(await screen.findByRole('alert')).toHaveTextContent("Cette candidature n'existe pas.")
    expect(screen.getByRole('link', { name: 'Retour à la liste' })).toBeInTheDocument()
  })

  it('does not even ask the API for an id that is not a number', async () => {
    const backend = fakeBackend()
    renderAt('/applications/abc/edit')
    expect(await screen.findByRole('alert')).toHaveTextContent("Cette candidature n'existe pas.")
    expect(backend.sent).toHaveLength(0)
  })
})

describe('confirmation message', () => {
  it('is shown once, then removed from the history entry so that a reload does not repeat it', async () => {
    fakeBackend({ initial: [ACME] })
    const router = createMemoryRouter([{ path: '*', element: <App /> }], {
      initialEntries: [{ pathname: '/', state: { notice: 'created' } }],
    })
    render(
      <I18nextProvider i18n={createI18n(resources, 'fr')}>
        <QueryClientProvider client={createQueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nextProvider>,
    )
    expect(await screen.findByText('Candidature créée.')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.state).toBeNull())
    // Still displayed after the state was cleared.
    expect(screen.getByText('Candidature créée.')).toBeInTheDocument()
  })

  it('ignores a notice it does not know', async () => {
    fakeBackend({ initial: [ACME] })
    const router = createMemoryRouter([{ path: '*', element: <App /> }], {
      initialEntries: [{ pathname: '/', state: { notice: 'hacked' } }],
    })
    render(
      <I18nextProvider i18n={createI18n(resources, 'fr')}>
        <QueryClientProvider client={createQueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nextProvider>,
    )
    await screen.findByRole('table', { name: 'Liste des candidatures' })
    expect(screen.queryByText(/notice\./)).not.toBeInTheDocument()
  })
})
