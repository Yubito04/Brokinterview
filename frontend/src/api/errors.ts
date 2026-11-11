// What went wrong, in terms the screens understand (not raw HTTP).
export type ApiErrorKind =
  | 'validation' // 422: the API rejected the data we sent
  | 'not_found' // 404
  | 'unavailable' // 503: the service cannot do this right now
  | 'upstream' // 502: the API is fine, the AI service behind it failed
  | 'timeout' // we gave up waiting
  | 'network' // no answer at all: API off, CORS, no connection
  | 'http' // any other error status

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  // Field name -> message, for errors that belong to one form field.
  readonly fieldErrors: Record<string, string>

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; fieldErrors?: Record<string, string> } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.fieldErrors = options.fieldErrors ?? {}
  }
}

type ValidationItem = { loc?: unknown; msg?: unknown }

function isValidationItem(item: unknown): item is ValidationItem {
  return typeof item === 'object' && item !== null
}

// FastAPI sends a 422 as {"detail": [{"loc": ["body", "company"], "msg": "..."}]}.
// loc[0] says where the problem is ("body", "query"...), the rest names the field.
// A loc of just ["body"] means "the whole body is wrong", which is how the PATCH
// rule "X cannot be null" arrives: that one is a general error, not a field one.
export function parseValidationDetail(detail: unknown): {
  fieldErrors: Record<string, string>
  formErrors: string[]
} {
  const fieldErrors: Record<string, string> = {}
  const formErrors: string[] = []
  if (!Array.isArray(detail)) return { fieldErrors, formErrors: ['Invalid data'] }

  for (const item of detail) {
    if (!isValidationItem(item)) continue
    const message = typeof item.msg === 'string' ? item.msg : 'Invalid value'
    const path = Array.isArray(item.loc) ? item.loc.slice(1).map(String) : []
    if (path.length === 0) {
      formErrors.push(message.replace(/^Value error, /, ''))
    } else {
      const field = path.join('.')
      // Keep the first message per field: one is enough to show next to it.
      fieldErrors[field] ??= message
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
    const message = formErrors[0] ?? 'Some fields are invalid.'
    return new ApiError('validation', message, { status, fieldErrors })
  }
  if (status === 404) return new ApiError('not_found', 'Not found.', { status })
  if (status === 503) {
    return new ApiError('unavailable', 'This service is not available right now.', { status })
  }
  if (status === 502) {
    return new ApiError('upstream', 'The AI service failed. Try again in a moment.', { status })
  }
  const message = typeof detail === 'string' ? detail : `Unexpected error (HTTP ${status}).`
  return new ApiError('http', message, { status })
}
