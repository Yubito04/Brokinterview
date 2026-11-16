import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../api/contacts'
import {
  EMPTY_CONTACT_FORM,
  formatContactDate,
  isoToLocalInput,
  localInputToIso,
  toCreateContactBody,
  toUpdateContactBody,
  valuesFromContact,
} from './contactValues'

const plain = (text: string) => text.replace(/[  ]/g, ' ')

const SAVED: Contact = {
  id: 5,
  application_id: 7,
  name: 'Alice',
  contacted_at: '2026-11-10T10:00:00Z',
  replied_at: null,
  state: 'WAITING',
  created_at: '2026-11-01T09:00:00Z',
}

// The same instant is a different wall-clock time depending on the timezone.
describe.each([
  ['Europe/Paris', '2026-11-10T10:00:00Z', '2026-11-10T11:00'],
  ['America/Los_Angeles', '2026-11-10T10:00:00Z', '2026-11-10T02:00'],
  // Summer time: Paris is UTC+2, Los Angeles UTC-7.
  ['Europe/Paris', '2026-07-10T10:00:00Z', '2026-07-10T12:00'],
  ['America/Los_Angeles', '2026-07-10T10:00:00Z', '2026-07-10T03:00'],
])('in %s', (timezone, iso, local) => {
  beforeEach(() => {
    vi.stubEnv('TZ', timezone)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it(`shows ${iso} as ${local}`, () => {
    expect(isoToLocalInput(iso)).toBe(local)
  })

  it('gives the same instant back when the shown time is sent', () => {
    expect(localInputToIso(local)).toBe(iso.replace(':00Z', ':00.000Z'))
  })
})

describe('isoToLocalInput and localInputToIso', () => {
  it('turn a missing or unreadable date into an empty input', () => {
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput('not a date')).toBe('')
  })

  it('turn an empty input into no date', () => {
    expect(localInputToIso('')).toBeNull()
    expect(localInputToIso('   ')).toBeNull()
  })

  it('send what it cannot read as it is, so that the server refuses it', () => {
    expect(localInputToIso('yesterday')).toBe('yesterday')
  })
})

describe('toCreateContactBody', () => {
  it('trims the name and leaves out the empty dates', () => {
    expect(toCreateContactBody({ ...EMPTY_CONTACT_FORM, name: ' Alice ' })).toEqual({ name: 'Alice' })
  })

  it('sends the dates as instants', () => {
    vi.stubEnv('TZ', 'Europe/Paris')
    const body = toCreateContactBody({
      name: 'Alice',
      contactedAt: '2026-11-10T11:00',
      repliedAt: '2026-11-11T09:30',
    })
    expect(body).toEqual({
      name: 'Alice',
      contacted_at: '2026-11-10T10:00:00.000Z',
      replied_at: '2026-11-11T08:30:00.000Z',
    })
    vi.unstubAllEnvs()
  })

  it('does not validate: an empty name is sent, the server decides', () => {
    expect(toCreateContactBody(EMPTY_CONTACT_FORM).name).toBe('')
  })
})

describe('toUpdateContactBody', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Europe/Paris')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is empty when nothing changed', () => {
    expect(toUpdateContactBody(SAVED, valuesFromContact(SAVED))).toEqual({})
  })

  it('contains only the field that changed', () => {
    const values = { ...valuesFromContact(SAVED), repliedAt: '2026-11-12T15:00' }
    expect(toUpdateContactBody(SAVED, values)).toEqual({
      replied_at: '2026-11-12T14:00:00.000Z',
    })
  })

  it('sends null to clear a date', () => {
    const values = { ...valuesFromContact(SAVED), contactedAt: '' }
    expect(toUpdateContactBody(SAVED, values)).toEqual({ contacted_at: null })
  })

  it('does not rewrite a saved date that has seconds the input cannot show', () => {
    const withSeconds = { ...SAVED, contacted_at: '2026-11-10T10:00:30Z' }
    expect(toUpdateContactBody(withSeconds, valuesFromContact(withSeconds))).toEqual({})
  })

  it('does not count spaces around the name as a change', () => {
    const values = { ...valuesFromContact(SAVED), name: ' Alice ' }
    expect(toUpdateContactBody(SAVED, values)).toEqual({})
  })
})

describe('formatContactDate', () => {
  it('shows the date and the time in the language, in the local timezone', () => {
    vi.stubEnv('TZ', 'Europe/Paris')
    expect(plain(formatContactDate('2026-11-10T10:00:00Z', 'en'))).toBe('Nov 10, 2026, 11:00 AM')
    expect(plain(formatContactDate('2026-11-10T10:00:00Z', 'fr'))).toContain('10 nov. 2026')
    expect(plain(formatContactDate('2026-11-10T10:00:00Z', 'fr'))).toContain('11:00')
    vi.unstubAllEnvs()
  })

  it('shows a dash for no date, and the text itself when it is not a date', () => {
    expect(formatContactDate(null, 'fr')).toBe('—')
    expect(formatContactDate('abc', 'fr')).toBe('abc')
  })
})
