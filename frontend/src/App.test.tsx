import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createI18n } from './i18n/createI18n'
import { readStoredLanguage } from './i18n/languageStorage'
import type { Language } from './i18n/languages'
import { resources } from './i18n/resources'
import { createQueryClient } from './queryClient'

// The language is a whole-app feature, so it is tested through the whole App.

function answerWith(total: number) {
  const items =
    total === 0
      ? []
      : [
          {
            id: 1,
            company: 'Acme',
            position: 'Developer',
            status: 'INTERVIEW',
            location: null,
            deadline: null,
            created_at: '2026-11-01T10:00:00Z',
          },
        ]
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ items, total, limit: 20, offset: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  )
}

// `language` omitted = the real start-up rules (stored choice, then browser).
function renderApp(url = '/', language?: Language) {
  render(
    <I18nextProvider i18n={createI18n(resources, language)}>
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[url]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
  return userEvent.setup()
}

const languageSelect = () => screen.getByRole('combobox', { name: 'Langue / Language' })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.lang = ''
})

describe('language of the interface', () => {
  it('starts in the browser language', async () => {
    answerWith(1)
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-CA'])
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Candidatures' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('fr')
    expect(languageSelect()).toHaveValue('fr')
  })

  it('starts in English when the browser speaks another language', async () => {
    answerWith(1)
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['de-DE'])
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
  })

  it('has a selector, found by the same name in both languages', async () => {
    answerWith(1)
    renderApp('/', 'fr')
    await screen.findByRole('table')
    const options = within(languageSelect()).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Français', 'English'])
    expect(options.map((option) => option.getAttribute('lang'))).toEqual(['fr', 'en'])
  })

  it('switches the whole screen without reloading, and updates <html lang>', async () => {
    answerWith(1)
    const user = renderApp('/', 'fr')
    const frenchTable = await screen.findByRole('table', { name: 'Liste des candidatures' })
    expect(within(frenchTable).getByRole('cell', { name: 'Entretien' })).toBeInTheDocument()

    await user.selectOptions(languageSelect(), 'English')

    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Applications list' })
    expect(within(table).getByRole('columnheader', { name: 'Company' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'Interview' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'All statuses' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /Search/ })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    // The selector itself stays findable under the same name.
    expect(languageSelect()).toHaveValue('en')

    await user.selectOptions(languageSelect(), 'Français')
    expect(screen.getByRole('heading', { name: 'Candidatures' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('fr')
  })

  it('remembers the choice for the next visit, against the browser language', async () => {
    answerWith(1)
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-CA'])
    const user = renderApp()
    await screen.findByRole('heading', { name: 'Candidatures' })

    await user.selectOptions(languageSelect(), 'English')
    expect(readStoredLanguage()).toBe('en')

    // A second visit: the first page is gone, a new translator is built from what is stored.
    cleanup()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Candidatures' })).not.toBeInTheDocument()
  })

  it('translates the empty-state messages too', async () => {
    answerWith(0)
    renderApp('/?status=OFFER', 'en')
    expect(
      await screen.findByText('No application matches the current filters.'),
    ).toBeInTheDocument()
  })
})
