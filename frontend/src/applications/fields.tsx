import { APPLICATION_STATUSES, parseStatus, type ApplicationStatus } from '../api/applications'
import { useT } from '../i18n/useT'
import { FormField } from './FormField'

const CONTROL_CLASSES = 'rounded border border-gray-400 px-2 py-1.5'

// The longest text the API accepts (String(200) column): maxLength only limits what
// can be typed, it is not a validation message.
const MAX_TEXT_LENGTH = 200

type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date' | 'datetime-local'
  required?: boolean
  error?: string
  hint?: string
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  error,
  hint,
}: TextFieldProps) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      {(control) => (
        <input
          {...control}
          type={type}
          value={value}
          maxLength={type === 'text' ? MAX_TEXT_LENGTH : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={CONTROL_CLASSES}
        />
      )}
    </FormField>
  )
}

type StatusFieldProps = {
  value: ApplicationStatus
  onChange: (status: ApplicationStatus) => void
  error?: string
}

export function StatusField({ value, onChange, error }: StatusFieldProps) {
  const t = useT()
  return (
    <FormField label={t('form.status')} required error={error}>
      {(control) => (
        <select
          {...control}
          value={value}
          onChange={(event) => {
            // The options are the known statuses; anything else is ignored.
            const status = parseStatus(event.target.value)
            if (status) onChange(status)
          }}
          className={CONTROL_CLASSES}
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      )}
    </FormField>
  )
}

type TextAreaFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  required?: boolean
  error?: string
}

// No `maxLength` here, on purpose: a browser silently CUTS a pasted text that is too long,
// and the user would send a posting without its end without knowing. Without the limit,
// the whole text stays, and the server's "too long" answer (before any paid call) tells
// the user what is wrong.
export function TextAreaField({ label, value, onChange, rows = 10, required, error }: TextAreaFieldProps) {
  return (
    <FormField label={label} required={required} error={error}>
      {(control) => (
        <textarea
          {...control}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={CONTROL_CLASSES}
        />
      )}
    </FormField>
  )
}
