import { act, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { createI18n, setLanguage } from './createI18n'
import { resources } from './resources'
import { useT, type MessageKey } from './useT'

function Probe() {
  const t = useT()
  return (
    <p>
      {t('pagination.next')} / {t('pagination.position', { page: 2, total: 5 })}
    </p>
  )
}

describe('useT', () => {
  it('translates with variables, and follows a language change', async () => {
    const i18n = createI18n(resources, 'fr')
    render(
      <I18nextProvider i18n={i18n}>
        <Probe />
      </I18nextProvider>,
    )
    expect(screen.getByText('Page suivante / Page 2 sur 5')).toBeInTheDocument()

    await act(() => setLanguage(i18n, 'en'))

    expect(screen.getByText('Next page / Page 2 of 5')).toBeInTheDocument()
  })
})

describe('MessageKey', () => {
  it('accepts the dictionary paths and refuses anything else (checked by tsc)', () => {
    const valid: MessageKey[] = ['pagination.next', 'status.OFFER', 'applications.empty.none']
    // @ts-expect-error a typo is not a key
    const typo: MessageKey = 'pagination.nxt'
    // @ts-expect-error a branch is not a key, only a text is
    const branch: MessageKey = 'pagination'
    expect(valid).toHaveLength(3)
    expect([typo, branch]).toHaveLength(2)
  })
})
