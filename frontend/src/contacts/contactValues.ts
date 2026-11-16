import type { Contact, ContactCreate, ContactUpdate } from '../api/contacts'

// What the contact form holds. Dates are the text of <input type="datetime-local">:
// "2026-11-10T14:30", in the user's LOCAL time, without any timezone. Empty = no date.
export type ContactFormValues = {
  name: string
  contactedAt: string
  repliedAt: string
}

export const EMPTY_CONTACT_FORM: ContactFormValues = { name: '', contactedAt: '', repliedAt: '' }

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

const two = (n: number) => String(n).padStart(2, '0')

// What the API stores is an instant ("2026-11-10T10:00:00Z", UTC). What a person reads
// and types is a wall-clock time in their own timezone: 11:00 in Paris, 02:00 in Los
// Angeles, for the same instant. Converting in both directions is the whole job here.
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}` +
    `T${two(date.getHours())}:${two(date.getMinutes())}`
  )
}

// The local time typed by the user, as an instant the API stores: always with its
// offset (toISOString gives "...Z"), so the server never has to guess a timezone.
// A text we cannot read is sent as it is: the server answers 422 and the form shows it.
export function localInputToIso(local: string): string | null {
  const text = local.trim()
  if (text === '') return null
  const match = LOCAL_INPUT.exec(text)
  if (!match) return text
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  return Number.isNaN(date.getTime()) ? text : date.toISOString()
}

export function valuesFromContact(contact: Contact): ContactFormValues {
  return {
    name: contact.name,
    contactedAt: isoToLocalInput(contact.contacted_at),
    repliedAt: isoToLocalInput(contact.replied_at),
  }
}

// No validation here: an empty name is sent and the server answers 422 (see formValues.ts).
export function toCreateContactBody(values: ContactFormValues): ContactCreate {
  const body: ContactCreate = { name: values.name.trim() }
  const contactedAt = localInputToIso(values.contactedAt)
  if (contactedAt !== null) body.contacted_at = contactedAt
  const repliedAt = localInputToIso(values.repliedAt)
  if (repliedAt !== null) body.replied_at = repliedAt
  return body
}

// A real PATCH, like toUpdateBody for applications. A date counts as changed when what
// the input shows differs from what it showed at the start: compared at the precision
// of the input (minutes). Comparing instants would see a "change" in a saved date that
// has seconds (10:00:30), which the input cannot display, and would rewrite it silently.
export function toUpdateContactBody(saved: Contact, values: ContactFormValues): ContactUpdate {
  const body: ContactUpdate = {}
  if (values.name.trim() !== saved.name) body.name = values.name.trim()
  if (values.contactedAt !== isoToLocalInput(saved.contacted_at)) {
    body.contacted_at = localInputToIso(values.contactedAt)
  }
  if (values.repliedAt !== isoToLocalInput(saved.replied_at)) {
    body.replied_at = localInputToIso(values.repliedAt)
  }
  return body
}

// A date and time for reading (in the user's timezone and the app's language).
export function formatContactDate(iso: string | null, language: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
