import { QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createI18n } from '../i18n/createI18n'
import { resources } from '../i18n/resources'
import { createQueryClient } from '../queryClient'
import { ApplicationsPage } from './ApplicationsPage'

// renderToString gives the HTML of the FIRST render only: effects have not run. That is
// exactly the moment a screen reader sees the page appear, so this is where the live
// region must already exist, and still be empty.
describe('the confirmation region of the list page', () => {
  it('is in the first render, empty, even when a confirmation is waiting', () => {
    const html = renderToString(
      <I18nextProvider i18n={createI18n(resources, 'fr')}>
        <QueryClientProvider client={createQueryClient()}>
          <MemoryRouter initialEntries={[{ pathname: '/', state: { notice: 'created' } }]}>
            <ApplicationsPage />
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>,
    )

    expect(html).toMatch(/<p role="status"[^>]*><\/p>/)
    expect(html).not.toContain('Candidature créée.')
  })
})
