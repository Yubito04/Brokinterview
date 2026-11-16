import { describe, expect, it } from 'vitest'
import { ApiError, type ApiErrorKind, type ValidationIssue } from '../api/errors'
import { createI18n } from './createI18n'
import { describeError, describeIssue } from './describeError'
import type { Language } from './languages'
import { resources } from './resources'
import type { Translate } from './useT'

function translator(language: Language): Translate {
  const i18n = createI18n(resources, language)
  return (key, values) => i18n.t(key, values)
}

const fr = translator('fr')
const en = translator('en')

const issue = (type: string, ctx: Record<string, unknown> = {}): ValidationIssue => ({
  type,
  ctx,
  message: 'English text from Pydantic',
})

describe('describeError', () => {
  const cases: [ApiErrorKind, ApiError, string, string][] = [
    [
      'network',
      new ApiError('network', 'Cannot reach the API. Is the server running?'),
      'Impossible de joindre le serveur. Est-il démarré ?',
      'Cannot reach the server. Is it running?',
    ],
    [
      'timeout',
      new ApiError('timeout', 'The server took more than 10 seconds', { params: { seconds: 10 } }),
      'Le serveur a mis plus de 10 secondes à répondre. Réessayez.',
      'The server took more than 10 seconds to answer. Try again.',
    ],
    [
      'unavailable',
      new ApiError('unavailable', 'no key', { status: 503 }),
      "Ce service n'est pas disponible pour le moment.",
      'This service is not available right now.',
    ],
    [
      'upstream',
      new ApiError('upstream', 'x', { status: 502 }),
      "Le service d'IA a échoué. Réessayez dans un instant.",
      'The AI service failed. Try again in a moment.',
    ],
    [
      'upstream_timeout',
      new ApiError('upstream_timeout', 'x', { status: 504 }),
      "Le service d'IA a mis trop de temps à répondre. Réessayez.",
      'The AI service took too long to answer. Try again.',
    ],
    [
      'not_found',
      new ApiError('not_found', 'Not found.', { status: 404 }),
      'Introuvable.',
      'Not found.',
    ],
    [
      'http',
      new ApiError('http', 'Boom', { status: 500, params: { status: 500 } }),
      'Erreur inattendue (HTTP 500).',
      'Unexpected error (HTTP 500).',
    ],
    [
      'validation',
      new ApiError('validation', 'Some fields are invalid.', { status: 422 }),
      'Certains champs sont invalides.',
      'Some fields are invalid.',
    ],
  ]

  it.each(cases)('says what happened for %s, in both languages', (_kind, error, french, english) => {
    expect(describeError(error, fr)).toBe(french)
    expect(describeError(error, en)).toBe(english)
  })

  it('never shows the developer message of the error', () => {
    const error = new ApiError('http', 'SQL exploded at line 42', { status: 500, params: { status: 500 } })
    expect(describeError(error, fr)).not.toContain('SQL')
    expect(describeError(error, en)).not.toContain('SQL')
  })

  it('covers every kind of error (this list must follow ApiErrorKind)', () => {
    expect(cases.map(([kind]) => kind).sort()).toEqual(
      ['http', 'network', 'not_found', 'timeout', 'unavailable', 'upstream', 'upstream_timeout', 'validation'],
    )
  })

  it('has a generic text for something that is not an ApiError', () => {
    expect(describeError(new TypeError('x is undefined'), fr)).toBe(
      'Une erreur inattendue est survenue.',
    )
    expect(describeError('oops', en)).toBe('An unexpected error occurred.')
  })
})

describe('describeIssue (Pydantic codes read from the real API)', () => {
  it.each([
    ['missing', {}, 'Ce champ est obligatoire.', 'This field is required.'],
    ['null_not_allowed', { field: 'company' }, 'Ce champ ne peut pas être vide.', 'This field cannot be empty.'],
    ['string_type', {}, 'Ce champ doit contenir du texte.', 'This field must contain text.'],
    ['string_too_short', { min_length: 1 }, 'Trop court (minimum : 1).', 'Too short (minimum: 1).'],
    ['string_too_long', { max_length: 200 }, 'Trop long (maximum : 200).', 'Too long (maximum: 200).'],
    ['enum', { expected: "'APPLIED' or 'OFFER'" }, "Cette valeur n'est pas dans la liste.", 'This value is not in the list.'],
    ['date_from_datetime_parsing', { error: 'input is too short' }, 'Date invalide (format AAAA-MM-JJ).', 'Invalid date (format YYYY-MM-DD).'],
    ['date_from_datetime_inexact', {}, 'Date invalide (format AAAA-MM-JJ).', 'Invalid date (format YYYY-MM-DD).'],
    ['reply_without_contact', {}, 'Une réponse suppose une date de contact.', 'A reply needs a contact date.'],
    ['reply_before_contact', {}, 'La réponse ne peut pas précéder le contact.', 'The reply cannot be earlier than the contact.'],
    ['datetime_from_date_parsing', { error: 'input is too short' }, 'Date et heure invalides.', 'Invalid date and time.'],
  ])('%s', (type, ctx, french, english) => {
    expect(describeIssue(issue(type, ctx), fr)).toBe(french)
    expect(describeIssue(issue(type, ctx), en)).toBe(english)
  })

  it('uses a generic text for a code it does not know', () => {
    expect(describeIssue(issue('json_invalid'), fr)).toBe('Valeur invalide.')
    expect(describeIssue(issue('something_new'), en)).toBe('Invalid value.')
  })

  it('does not build a broken sentence when the detail it needs is missing', () => {
    expect(describeIssue(issue('string_too_short', {}), en)).toBe('Invalid value.')
    expect(describeIssue(issue('string_too_long', { max_length: null }), fr)).toBe('Valeur invalide.')
  })

  it('never shows the English message sent by Pydantic', () => {
    expect(describeIssue(issue('missing'), fr)).not.toContain('English text')
  })
})
