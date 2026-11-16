import { describe, expect, it } from 'vitest'
import type { Application } from '../api/applications'
import {
  EMPTY_FORM,
  isEmptyUpdate,
  toCreateBody,
  toUpdateBody,
  valuesFromApplication,
} from './applicationForm'

const SAVED: Application = {
  id: 1,
  company: 'Acme',
  position: 'Developer',
  status: 'INTERVIEW',
  location: 'Paris',
  deadline: '2026-11-20',
  created_at: '2026-11-01T10:00:00Z',
}

describe('valuesFromApplication', () => {
  it('turns missing optional fields into empty texts', () => {
    const values = valuesFromApplication({ ...SAVED, location: null, deadline: null })
    expect(values.location).toBe('')
    expect(values.deadline).toBe('')
  })

  it('copies the others as they are', () => {
    expect(valuesFromApplication(SAVED)).toEqual({
      company: 'Acme',
      position: 'Developer',
      status: 'INTERVIEW',
      location: 'Paris',
      deadline: '2026-11-20',
    })
  })
})

describe('toCreateBody', () => {
  it('leaves out the optional fields that are empty or only spaces', () => {
    const body = toCreateBody({ ...EMPTY_FORM, company: 'Acme', position: 'Dev', location: '  ' })
    expect(body).toEqual({ company: 'Acme', position: 'Dev', status: 'APPLIED' })
    expect('location' in body).toBe(false)
    expect('deadline' in body).toBe(false)
  })

  it('trims the texts and keeps the filled optional fields', () => {
    const body = toCreateBody({
      company: ' Acme ',
      position: ' Dev ',
      status: 'OFFER',
      location: ' Lyon ',
      deadline: '2026-12-01',
    })
    expect(body).toEqual({
      company: 'Acme',
      position: 'Dev',
      status: 'OFFER',
      location: 'Lyon',
      deadline: '2026-12-01',
    })
  })

  it('does not validate: an empty company is sent, the server decides', () => {
    expect(toCreateBody(EMPTY_FORM).company).toBe('')
  })
})

describe('toUpdateBody', () => {
  it('is empty when nothing changed', () => {
    const body = toUpdateBody(SAVED, valuesFromApplication(SAVED))
    expect(body).toEqual({})
    expect(isEmptyUpdate(body)).toBe(true)
  })

  it('contains only the fields that changed', () => {
    const values = { ...valuesFromApplication(SAVED), status: 'OFFER' as const, company: 'Globex' }
    expect(toUpdateBody(SAVED, values)).toEqual({ company: 'Globex', status: 'OFFER' })
  })

  it('does not count spaces around a text as a change', () => {
    const values = { ...valuesFromApplication(SAVED), company: ' Acme ' }
    expect(toUpdateBody(SAVED, values)).toEqual({})
  })

  it('sends null to clear an optional field that was emptied', () => {
    const values = { ...valuesFromApplication(SAVED), location: '', deadline: '' }
    expect(toUpdateBody(SAVED, values)).toEqual({ location: null, deadline: null })
  })

  it('sends nothing for an optional field that was empty and still is', () => {
    const saved = { ...SAVED, location: null }
    const values = { ...valuesFromApplication(saved), location: '  ' }
    expect(toUpdateBody(saved, values)).toEqual({})
  })

  it('sends a value for an optional field that was empty and is now filled', () => {
    const saved = { ...SAVED, deadline: null }
    const values = { ...valuesFromApplication(saved), deadline: '2027-01-15' }
    expect(toUpdateBody(saved, values)).toEqual({ deadline: '2027-01-15' })
  })

  it('sends an emptied company as it is: the server refuses it (422)', () => {
    const values = { ...valuesFromApplication(SAVED), company: '' }
    expect(toUpdateBody(SAVED, values)).toEqual({ company: '' })
  })
})
