import { useId, type ReactNode } from 'react'

// What a control needs to be tied to its label, its error and its "required" state.
export type ControlProps = {
  id: string
  'aria-required'?: true
  'aria-invalid'?: true
  'aria-describedby'?: string
}

type Props = {
  label: string
  required?: boolean
  // The error text, already translated. Absent = the field is fine.
  error?: string
  // A short note about the field, read after its label (not an error).
  hint?: string
  // The control itself, given what it needs: a text input, a select...
  children: (control: ControlProps) => ReactNode
}

// Label + control + error message, with the accessibility links in one place:
// - htmlFor/id: the screen reader announces the label on focus;
// - aria-required: announced as "required". The native `required` attribute is NOT
//   used: it brings the browser's own bubbles, in the browser's language (the form
//   has noValidate, so only the server's translated errors are shown);
// - aria-invalid + aria-describedby: the error is read after the label;
// - role="alert" on the message: announced as soon as it appears.
export function FormField({ label, required = false, error, hint, children }: Props) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const control: ControlProps = { id }
  if (required) control['aria-required'] = true
  if (error) control['aria-invalid'] = true
  // The hint first, then the error: read in the order the user needs them.
  const described = [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean)
  if (described.length > 0) control['aria-describedby'] = described.join(' ')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {/* The star is only visual: the screen reader gets aria-required instead. */}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children(control)}
      {hint && (
        <p id={hintId} className="text-sm text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
