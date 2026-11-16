import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from '../i18n/createI18n'
import { resources } from '../i18n/resources'
import { StatusField, TextField } from './fields'

function renderInFrench(ui: React.ReactElement) {
  render(<I18nextProvider i18n={createI18n(resources, 'fr')}>{ui}</I18nextProvider>)
  return userEvent.setup()
}

describe('TextField', () => {
  it('is found by its label and shows its value', () => {
    renderInFrench(<TextField label="Entreprise" value="Acme" onChange={() => {}} />)
    expect(screen.getByRole('textbox', { name: 'Entreprise' })).toHaveValue('Acme')
  })

  it('reports what the user types', async () => {
    const onChange = vi.fn()
    const user = renderInFrench(<TextField label="Entreprise" value="" onChange={onChange} />)
    await user.type(screen.getByRole('textbox', { name: 'Entreprise' }), 'A')
    expect(onChange).toHaveBeenCalledWith('A')
  })

  it('announces a required field without the browser own validation', () => {
    renderInFrench(<TextField label="Entreprise" value="" onChange={() => {}} required />)
    const input = screen.getByRole('textbox', { name: /Entreprise/ })
    expect(input).toHaveAttribute('aria-required', 'true')
    // Native `required` would bring the browser's bubbles, in the browser's language.
    expect(input).not.toHaveAttribute('required')
  })

  it('hides the visual star from the accessible name', () => {
    renderInFrench(<TextField label="Entreprise" value="" onChange={() => {}} required />)
    expect(screen.getByRole('textbox', { name: 'Entreprise' })).toBeInTheDocument()
  })

  it('has no error state while there is no error', () => {
    renderInFrench(<TextField label="Entreprise" value="" onChange={() => {}} />)
    const input = screen.getByRole('textbox', { name: 'Entreprise' })
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ties its error to the field: invalid, described, announced', () => {
    renderInFrench(
      <TextField label="Entreprise" value="" onChange={() => {}} error="Ce champ est obligatoire." />,
    )
    const input = screen.getByRole('textbox', { name: 'Entreprise' })
    expect(input).toBeInvalid()
    expect(input).toHaveAccessibleDescription('Ce champ est obligatoire.')
    expect(screen.getByRole('alert')).toHaveTextContent('Ce champ est obligatoire.')
  })

  it('limits what can be typed to 200 characters for a text, not for a date', () => {
    renderInFrench(
      <>
        <TextField label="Lieu" value="" onChange={() => {}} />
        <TextField label="Date limite" value="" onChange={() => {}} type="date" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Lieu' })).toHaveAttribute('maxlength', '200')
    expect(screen.getByLabelText('Date limite')).not.toHaveAttribute('maxlength')
  })

  it('gives two fields on the same screen two different links', () => {
    renderInFrench(
      <>
        <TextField label="Entreprise" value="" onChange={() => {}} error="Erreur A" />
        <TextField label="Poste" value="" onChange={() => {}} error="Erreur B" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Entreprise' })).toHaveAccessibleDescription('Erreur A')
    expect(screen.getByRole('textbox', { name: 'Poste' })).toHaveAccessibleDescription('Erreur B')
  })
})

describe('StatusField', () => {
  it('lists the four statuses in the language, and is required', () => {
    renderInFrench(<StatusField value="APPLIED" onChange={() => {}} />)
    const select = screen.getByRole('combobox', { name: /Statut/ })
    expect(select).toHaveValue('APPLIED')
    expect(select).toHaveAttribute('aria-required', 'true')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Postulé',
      'Entretien',
      'Offre',
      'Refusé',
    ])
  })

  it('reports the chosen status as the API code, not the label', async () => {
    const onChange = vi.fn()
    const user = renderInFrench(<StatusField value="APPLIED" onChange={onChange} />)
    await user.selectOptions(screen.getByRole('combobox', { name: /Statut/ }), 'Offre')
    expect(onChange).toHaveBeenCalledWith('OFFER')
  })

  it('shows its error like a text field', () => {
    renderInFrench(<StatusField value="APPLIED" onChange={() => {}} error="Pas dans la liste." />)
    expect(screen.getByRole('combobox', { name: /Statut/ })).toHaveAccessibleDescription(
      'Pas dans la liste.',
    )
  })
})
