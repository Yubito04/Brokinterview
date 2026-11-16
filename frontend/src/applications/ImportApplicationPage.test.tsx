import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { Application } from '../api/applications'
import type { ExtractedJob } from '../api/jobPostings'
import { createI18n } from '../i18n/createI18n'
import type { Language } from '../i18n/languages'
import { resources } from '../i18n/resources'
import { createQueryClient } from '../queryClient'

// The import screen, tested through the whole App. The AI is a fake backend answer: no
// test calls a real model (that would cost money and be unrepeatable).

const FOUND: ExtractedJob = {
  company: 'Acme',
  position: 'Backend Developer',
  location: 'Montreal',
  deadline: '2026-12-15',
  skills: ['Python', 'PostgreSQL'],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// What the fake AI endpoint does for one call.
type Extraction = ExtractedJob | { status: number; body: unknown } | 'network'

type Sent = { method: string; path: string; body?: Record<string, unknown> }

type Options = {
  // Answers in order; the last one answers every further call.
  extractions?: Extraction[]
  // The extraction waits until release() is called (no timer: the test decides).
  holdExtraction?: boolean
}

function fakeBackend({ extractions = [FOUND], holdExtraction = false }: Options = {}) {
  const created: Application[] = []
  const sent: Sent[] = []
  let call = 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input)
      const method = init?.method ?? 'GET'
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined
      sent.push({ method, path: url.pathname, body })

      if (url.pathname === '/job-postings/extract') {
        if (holdExtraction) {
          // Gives up when the caller cancels, like a real fetch.
          await Promise.race([
            gate,
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
            }),
          ])
        }
        const answer = extractions[Math.min(call, extractions.length - 1)]
        call += 1
        if (answer === 'network') throw new TypeError('Failed to fetch')
        if ('status' in answer) return json(answer.body, answer.status)
        return json(answer)
      }
      if (url.pathname === '/applications' && method === 'POST') {
        const application: Application = {
          id: 100 + created.length,
          company: body!.company as string,
          position: body!.position as string,
          status: body!.status as Application['status'],
          location: (body!.location as string | undefined) ?? null,
          deadline: (body!.deadline as string | undefined) ?? null,
          created_at: '2026-11-17T10:00:00Z',
        }
        created.push(application)
        return json(application, 201)
      }
      if (url.pathname === '/applications') {
        return json({ items: created, total: created.length, limit: 20, offset: 0 })
      }
      return json({ detail: 'unexpected' }, 500)
    }),
  )

  const extractCalls = () => sent.filter((request) => request.path === '/job-postings/extract')
  return { sent, created, extractCalls, release: () => release() }
}

function renderPage(language: Language = 'fr', url = '/applications/import') {
  const router = createMemoryRouter([{ path: '*', element: <App /> }], {
    initialEntries: [url],
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

afterEach(() => {
  vi.unstubAllGlobals()
})

const postingBox = () => screen.getByRole('textbox', { name: "Texte de l'offre" })
const extractButton = () => screen.getByRole('button', { name: 'Extraire les champs' })
const liveRegion = () => screen.getAllByRole('status').at(-1)!

async function pasteAndExtract(user: ReturnType<typeof userEvent.setup>, text = 'Acme recrute') {
  await user.click(postingBox())
  await user.paste(text)
  await user.click(extractButton())
}

describe('opening the import screen', () => {
  it('opens from the link of the list', async () => {
    fakeBackend()
    const user = renderPage('fr', '/')

    await user.click(await screen.findByRole('link', { name: 'Importer une offre' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Importer une offre' })).toBeInTheDocument()
    expect(postingBox()).toBeInTheDocument()
  })
})

describe('extracting the fields of a posting', () => {
  it('asks for a text first: an empty one is refused by the server, translated, with the focus', async () => {
    const backend = fakeBackend({
      extractions: [
        {
          status: 422,
          body: { detail: [{ type: 'text_blank', loc: ['body', 'text'], msg: 'text cannot be empty' }] },
        },
      ],
    })
    const user = renderPage()

    await user.click(extractButton())

    expect(await screen.findByRole('textbox', { name: "Texte de l'offre" })).toHaveAccessibleDescription(
      "Collez le texte d'une offre.",
    )
    expect(postingBox()).toHaveFocus()
    expect(backend.extractCalls()).toHaveLength(1)
  })

  it('sends the text, then shows the form filled with what was found, and folds the text', async () => {
    const backend = fakeBackend()
    const user = renderPage()

    await pasteAndExtract(user, 'Acme recrute un développeur')

    expect(backend.extractCalls()[0].body).toEqual({ text: 'Acme recrute un développeur' })
    const review = await screen.findByRole('region', { name: 'Relecture avant création' })
    expect(within(review).getByRole('textbox', { name: /Entreprise/ })).toHaveValue('Acme')
    expect(within(review).getByRole('textbox', { name: /Poste/ })).toHaveValue('Backend Developer')
    expect(within(review).getByRole('textbox', { name: 'Lieu' })).toHaveValue('Montreal')
    expect(within(review).getByLabelText('Date limite')).toHaveValue('2026-12-15')
    expect(within(review).getByRole('combobox', { name: /Statut/ })).toHaveValue('APPLIED')
    // The posting stays on the page, folded.
    expect(document.querySelector('details')!.open).toBe(false)
    expect(postingBox()).toHaveValue('Acme recrute un développeur')
  })

  it('creates the application from the reviewed fields and goes back to the list', async () => {
    const backend = fakeBackend()
    const user = renderPage()
    await pasteAndExtract(user)

    const review = await screen.findByRole('region', { name: 'Relecture avant création' })
    await user.clear(within(review).getByRole('textbox', { name: /Poste/ }))
    await user.type(within(review).getByRole('textbox', { name: /Poste/ }), 'Senior Developer')
    await user.click(within(review).getByRole('button', { name: 'Créer la candidature' }))

    expect(await screen.findByText('Candidature créée.')).toBeInTheDocument()
    expect(backend.created).toHaveLength(1)
    // What the user corrected is what was sent, not what the AI said.
    expect(backend.sent.find((r) => r.method === 'POST' && r.path === '/applications')!.body).toEqual({
      company: 'Acme',
      position: 'Senior Developer',
      status: 'APPLIED',
      location: 'Montreal',
      deadline: '2026-12-15',
    })
  })

  it('does not save anything by itself: extracting creates no application', async () => {
    const backend = fakeBackend()
    const user = renderPage()
    await pasteAndExtract(user)
    await screen.findByRole('region', { name: 'Relecture avant création' })
    expect(backend.sent.filter((r) => r.method === 'POST' && r.path === '/applications')).toHaveLength(0)
  })
})

describe('while the AI is working', () => {
  it('shows the wait, blocks a second call, and offers to cancel', async () => {
    const backend = fakeBackend({ holdExtraction: true })
    const user = renderPage()
    await user.click(postingBox())
    await user.paste('Acme recrute')

    await user.click(extractButton())

    expect(screen.getByRole('button', { name: 'Extraction en cours…' })).toBeDisabled()
    expect(liveRegion()).toHaveTextContent('Extraction en cours…')
    expect(screen.getByRole('button', { name: "Annuler l'extraction" })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Extraction en cours…' }))
    backend.release()

    expect(await screen.findByRole('region', { name: 'Relecture avant création' })).toBeInTheDocument()
    expect(backend.extractCalls()).toHaveLength(1)
    expect(liveRegion()).toHaveTextContent('')
  })

  it('stops waiting on cancel, without showing an error, and keeps the text', async () => {
    const backend = fakeBackend({ holdExtraction: true })
    const user = renderPage()
    await user.click(postingBox())
    await user.paste('Acme recrute')
    await user.click(extractButton())

    await user.click(screen.getByRole('button', { name: "Annuler l'extraction" }))

    await waitFor(() => expect(extractButton()).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Relecture avant création' })).not.toBeInTheDocument()
    expect(postingBox()).toHaveValue('Acme recrute')
    expect(liveRegion()).toHaveTextContent('')
    // Cancelling is not a way to send a second paid call by accident: still one call.
    expect(backend.extractCalls()).toHaveLength(1)
  })
})

describe('when the extraction fails', () => {
  it.each([
    [{ status: 502, body: { detail: 'AI extraction failed' } }, "Le service d'IA a échoué"],
    [{ status: 503, body: { detail: 'not configured' } }, "Ce service n'est pas disponible"],
    [{ status: 504, body: { detail: 'timed out' } }, "Le service d'IA a mis trop de temps"],
    ['network', 'Impossible de joindre le serveur'],
  ] as const)('shows a translated message, keeps the text, and lets the user try again (%#)', async (answer, message) => {
    const backend = fakeBackend({ extractions: [answer, FOUND] })
    const user = renderPage()

    await pasteAndExtract(user, 'Acme recrute')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("L'extraction a échoué")
    expect(alert).toHaveTextContent(message)
    expect(alert).not.toHaveTextContent('Cannot reach the API')
    expect(alert).toHaveFocus()
    expect(postingBox()).toHaveValue('Acme recrute')
    expect(extractButton()).toBeEnabled()

    // A second attempt is the user's decision, never automatic.
    expect(backend.extractCalls()).toHaveLength(1)
    await user.click(extractButton())
    expect(await screen.findByRole('region', { name: 'Relecture avant création' })).toBeInTheDocument()
    expect(backend.extractCalls()).toHaveLength(2)
  })

  it('tells the user the text is too long, from the server, and keeps all of it', async () => {
    fakeBackend({
      extractions: [
        {
          status: 422,
          body: {
            detail: [
              {
                type: 'string_too_long',
                loc: ['body', 'text'],
                msg: 'x',
                ctx: { max_length: 20000 },
              },
            ],
          },
        },
      ],
    })
    const user = renderPage()
    const long = 'x'.repeat(20_050)
    await user.click(postingBox())
    await user.paste(long)
    await user.click(extractButton())

    expect(await screen.findByRole('textbox', { name: "Texte de l'offre" })).toHaveAccessibleDescription(
      'Trop long (maximum : 20000).',
    )
    // Nothing was cut by the browser: the whole text is still there.
    expect((postingBox() as HTMLTextAreaElement).value).toHaveLength(20_050)
  })

  it('keeps the previous review when a second extraction fails', async () => {
    fakeBackend({ extractions: [FOUND, { status: 502, body: { detail: 'x' } }] })
    const user = renderPage()
    await pasteAndExtract(user)
    await screen.findByRole('region', { name: 'Relecture avant création' })

    await user.click(screen.getByText("Texte de l'offre", { selector: 'summary' }))
    await user.click(extractButton())

    expect(await screen.findByRole('alert')).toHaveTextContent("Le service d'IA a échoué")
    expect(screen.getByRole('region', { name: 'Relecture avant création' })).toBeInTheDocument()
  })
})

describe('a second extraction', () => {
  it('replaces the form with the new answer', async () => {
    fakeBackend({ extractions: [FOUND, { ...FOUND, company: 'Globex', location: null }] })
    const user = renderPage()
    await pasteAndExtract(user)
    await screen.findByRole('region', { name: 'Relecture avant création' })

    await user.click(screen.getByText("Texte de l'offre", { selector: 'summary' }))
    await user.click(extractButton())

    await waitFor(() => expect(screen.getByRole('textbox', { name: /Entreprise/ })).toHaveValue('Globex'))
    expect(screen.getByRole('textbox', { name: 'Lieu' })).toHaveValue('')
  })
})

describe('in English', () => {
  it('shows the screen and the errors in English', async () => {
    fakeBackend({ extractions: [{ status: 502, body: { detail: 'x' } }] })
    const user = renderPage('en')
    await user.click(screen.getByRole('textbox', { name: 'Job posting text' }))
    await user.paste('Acme is hiring')
    await user.click(screen.getByRole('button', { name: 'Extract the fields' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The extraction failed:')
    expect(alert).toHaveTextContent('The AI service failed')
  })
})
