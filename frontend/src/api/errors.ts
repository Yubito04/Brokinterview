// What went wrong, in terms the screens understand (not raw HTTP).
export type ApiErrorKind =
  | 'validation' // 422: the API rejected the data we sent
  | 'not_found' // 404
  | 'unavailable' // 503: the service cannot do this right now
  | 'upstream' // 502: the API is fine, the AI service behind it failed
  | 'upstream_timeout' // 504: the AI service did not answer in time
  | 'timeout' // we gave up waiting
  | 'network' // no answer at all: API off, CORS, no connection
  | 'http' // any other error status

// One thing the API found wrong in the data we sent (one entry of a 422's `detail`).
// `type` is Pydantic's stable error code ("missing", "string_too_short"...) and `ctx`
// its details ({min_length: 1}): the screens translate from these. `message` is
// Pydantic's English sentence, kept only for logs and debugging, never shown.
export type ValidationIssue = {
  type: string
  ctx: Record<string, unknown>
  message: string
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  // Field name -> what is wrong, for errors that belong to one form field.
  readonly fieldErrors: Record<string, ValidationIssue>
  // Problems that belong to no particular field.
  readonly formErrors: ValidationIssue[]
  // Numbers the translated message needs ({seconds: 10} for a timeout, {status: 500}).
  readonly params: Record<string, number>

  // `message` is English and for developers (logs, debugger). What the user reads
  // is chosen by `kind` and written in the user's language: see describeError.
  constructor(
    kind: ApiErrorKind,
    message: string,
    options: {
      status?: number
      fieldErrors?: Record<string, ValidationIssue>
      formErrors?: ValidationIssue[]
      params?: Record<string, number>
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.fieldErrors = options.fieldErrors ?? {}
    this.formErrors = options.formErrors ?? []
    this.params = options.params ?? {}
  }
}

type ValidationItem = { loc?: unknown; msg?: unknown; type?: unknown; ctx?: unknown }

function isValidationItem(item: unknown): item is ValidationItem {
  return typeof item === 'object' && item !== null
}

// FastAPI sends a 422 as {"detail": [{"type": "missing", "loc": ["body", "company"],
// "msg": "...", "ctx": {...}}]}. loc[0] says where the problem is ("body", "query"...),
// the rest names the field. A loc of just ["body"] means "the whole body is wrong".
// One exception: the PATCH rule "X cannot be null" also arrives with loc ["body"], but
// its code is "null_not_allowed" and ctx.field names the field, so it is a field error.
export function parseValidationDetail(detail: unknown): {
  fieldErrors: Record<string, ValidationIssue>
  formErrors: ValidationIssue[]
} {
  const fieldErrors: Record<string, ValidationIssue> = {}
  const formErrors: ValidationIssue[] = []
  if (!Array.isArray(detail)) {
    return { fieldErrors, formErrors: [{ type: 'unknown', ctx: {}, message: 'Invalid data' }] }
  }

  for (const item of detail) {
    if (!isValidationItem(item)) continue
    const type = typeof item.type === 'string' ? item.type : 'unknown'
    const ctx =
      typeof item.ctx === 'object' && item.ctx !== null ? (item.ctx as Record<string, unknown>) : {}
    const message = typeof item.msg === 'string' ? item.msg : 'Invalid value'
    const issue: ValidationIssue = { type, ctx, message: message.replace(/^Value error, /, '') }

    let path = Array.isArray(item.loc) ? item.loc.slice(1).map(String) : []
    if (type === 'null_not_allowed' && typeof ctx.field === 'string') path = [ctx.field]

    if (path.length === 0) {
      formErrors.push(issue)
    } else {
      // Keep the first issue per field: one is enough to show next to it.
      fieldErrors[path.join('.')] ??= issue
    }
  }
  return { fieldErrors, formErrors }
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined // the answer was not JSON (e.g. an HTML error page)
  }
  const detail =
    typeof body === 'object' && body !== null && 'detail' in body
      ? (body as { detail: unknown }).detail
      : undefined
  const { status } = response

  if (status === 422) {
    const { fieldErrors, formErrors } = parseValidationDetail(detail)
    const message = formErrors[0]?.message ?? 'Some fields are invalid.'
    return new ApiError('validation', message, { status, fieldErrors, formErrors })
  }
  if (status === 404) return new ApiError('not_found', 'Not found.', { status })
  if (status === 503) {
    return new ApiError('unavailable', 'This service is not available right now.', { status })
  }
  if (status === 502) {
    return new ApiError('upstream', 'The AI service failed. Try again in a moment.', { status })
  }
  if (status === 504) {
    return new ApiError('upstream_timeout', 'The AI service took too long. Try again.', {
      status,
    })
  }
  const message = typeof detail === 'string' ? detail : `Unexpected error (HTTP ${status}).`
  return new ApiError('http', message, { status, params: { status } })
}
