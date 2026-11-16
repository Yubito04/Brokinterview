import { useEffect, useRef, type RefObject } from 'react'
import { ApiError } from '../api'
import { describeError, describeIssue } from '../i18n/describeError'
import { useT } from '../i18n/useT'

type ServerErrors = {
  formRef: RefObject<HTMLFormElement | null>
  summaryRef: RefObject<HTMLDivElement | null>
  // The translated text of what is wrong with one field, if anything.
  fieldError: (name: string) => string | undefined
  // What belongs under no field: network or server errors, and 422 issues about a field
  // this form does not have.
  summary: string[]
}

// What every form does with the answer of a failed save: put each 422 issue under its
// field, gather the rest in one summary, and move the keyboard to the first thing to fix.
// `fieldNames` are the API's names for the fields of THIS form.
export function useServerErrors(error: unknown, fieldNames: readonly string[]): ServerErrors {
  const t = useT()
  const formRef = useRef<HTMLFormElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  const apiError = error instanceof ApiError ? error : undefined
  const fieldError = (name: string) => {
    const issue = apiError?.fieldErrors[name]
    return issue ? describeIssue(issue, t) : undefined
  }

  const summary: string[] = []
  if (error && apiError?.kind !== 'validation') summary.push(describeError(error, t))
  if (apiError) {
    for (const issue of apiError.formErrors) summary.push(describeIssue(issue, t))
    for (const [name, issue] of Object.entries(apiError.fieldErrors)) {
      if (!fieldNames.includes(name)) summary.push(describeIssue(issue, t))
    }
  }

  // After a failed attempt the keyboard goes to the first invalid field, or to the
  // summary when no field is concerned. Otherwise a keyboard or screen reader user
  // would stay on the button with no idea what happened.
  useEffect(() => {
    if (!error) return
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    ;(firstInvalid ?? summaryRef.current)?.focus()
  }, [error])

  return { formRef, summaryRef, fieldError, summary }
}
