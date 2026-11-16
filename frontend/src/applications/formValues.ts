import type {
  Application,
  ApplicationCreate,
  ApplicationStatus,
  ApplicationUpdate,
} from '../api/applications'

// What the form holds: every field is text, because that is what an input gives.
// An empty text means "nothing" for the optional fields.
export type FormValues = {
  company: string
  position: string
  status: ApplicationStatus
  location: string
  deadline: string // "YYYY-MM-DD", the format of <input type="date"> and of the API
}

export const EMPTY_FORM: FormValues = {
  company: '',
  position: '',
  status: 'APPLIED',
  location: '',
  deadline: '',
}

export function valuesFromApplication(application: Application): FormValues {
  return {
    company: application.company,
    position: application.position,
    status: application.status,
    location: application.location ?? '',
    deadline: application.deadline ?? '',
  }
}

// Optional text: spaces around are dropped, nothing left means "no value".
function optional(text: string): string | null {
  return text.trim() === '' ? null : text.trim()
}

// No validation here on purpose: an empty company is sent as it is and the server
// answers 422 (string_too_short), which the form shows under the field. One place
// owns the rules (the API), so the form and the server can never disagree.
export function toCreateBody(values: FormValues): ApplicationCreate {
  const body: ApplicationCreate = {
    company: values.company.trim(),
    position: values.position.trim(),
    status: values.status,
  }
  // An optional field left empty is left out, so the API applies its own default.
  const location = optional(values.location)
  if (location !== null) body.location = location
  const deadline = optional(values.deadline)
  if (deadline !== null) body.deadline = deadline
  return body
}

// A real PATCH: only what differs from the saved application. A field left out means
// "do not change it"; null (an optional field emptied) means "clear it".
export function toUpdateBody(saved: Application, values: FormValues): ApplicationUpdate {
  const body: ApplicationUpdate = {}
  if (values.company.trim() !== saved.company) body.company = values.company.trim()
  if (values.position.trim() !== saved.position) body.position = values.position.trim()
  if (values.status !== saved.status) body.status = values.status
  if (optional(values.location) !== saved.location) body.location = optional(values.location)
  if (optional(values.deadline) !== saved.deadline) body.deadline = optional(values.deadline)
  return body
}

export function isEmptyUpdate(body: ApplicationUpdate): boolean {
  return Object.keys(body).length === 0
}
