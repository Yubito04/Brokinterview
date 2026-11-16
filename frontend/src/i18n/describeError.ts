import { ApiError, type ApiErrorKind, type ValidationIssue } from '../api/errors'
import type { MessageKey, Translate } from './useT'

// Which text each kind of error shows. Typed as a Record over every kind: adding a
// kind to ApiError without a text here is a compile error.
const ERROR_KEYS: Record<ApiErrorKind, MessageKey> = {
  network: 'errors.network',
  timeout: 'errors.timeout',
  unavailable: 'errors.unavailable',
  upstream: 'errors.upstream',
  upstream_timeout: 'errors.upstreamTimeout',
  not_found: 'errors.notFound',
  http: 'errors.http',
  validation: 'errors.validation',
}

// What the user reads for any error caught by a screen. The error's own `message`
// (English, for developers) is never shown.
export function describeError(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) return t('errors.unknown')
  return t(ERROR_KEYS[error.kind], error.params)
}

// One text per Pydantic error code. `values` maps a variable of the text ({{min}})
// to the name of the detail (ctx.min_length) that fills it.
type IssueText = { key: MessageKey; values?: Record<string, string> }

const ISSUE_TEXTS: Record<string, IssueText> = {
  missing: { key: 'validation.missing' },
  null_not_allowed: { key: 'validation.nullNotAllowed' },
  string_type: { key: 'validation.notText' },
  string_too_short: { key: 'validation.tooShort', values: { min: 'min_length' } },
  string_too_long: { key: 'validation.tooLong', values: { max: 'max_length' } },
  enum: { key: 'validation.unknownChoice' },
  // The codes below were read from the real API's answers, not guessed: a malformed
  // date string is "date_from_datetime_parsing", for example.
  date_from_datetime_parsing: { key: 'validation.invalidDate' },
  date_from_datetime_inexact: { key: 'validation.invalidDate' },
  date_parsing: { key: 'validation.invalidDate' },
  date_type: { key: 'validation.invalidDate' },
  datetime_from_date_parsing: { key: 'validation.invalidDateTime' },
  datetime_parsing: { key: 'validation.invalidDateTime' },
  datetime_type: { key: 'validation.invalidDateTime' },
}

// What is wrong with one field. A code we do not know, or a detail the text needs but
// the API did not send, gives the generic "Invalid value" rather than a broken sentence.
export function describeIssue(issue: ValidationIssue, t: Translate): string {
  const text = ISSUE_TEXTS[issue.type]
  if (!text) return t('validation.invalid')

  const values: Record<string, number | string> = {}
  for (const [variable, detail] of Object.entries(text.values ?? {})) {
    const value = issue.ctx[detail]
    if (typeof value !== 'number' && typeof value !== 'string') return t('validation.invalid')
    values[variable] = value
  }
  return t(text.key, values)
}
