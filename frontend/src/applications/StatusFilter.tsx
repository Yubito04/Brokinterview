import { useId } from 'react'
import {
  APPLICATION_STATUSES,
  parseStatus,
  type ApplicationStatus,
} from '../api/applications'
import { useT } from '../i18n/useT'

type Props = {
  value: ApplicationStatus | undefined
  onChange: (status: ApplicationStatus | undefined) => void
}

export function StatusFilter({ value, onChange }: Props) {
  const t = useT()
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      {/* htmlFor/id ties the label to the select: a screen reader announces
          "Statut" on focus, and clicking the label focuses the field. */}
      <label htmlFor={id} className="text-sm font-medium">
        {t('filters.statusLabel')}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(parseStatus(event.target.value))}
        className="rounded border border-gray-400 px-2 py-1.5"
      >
        <option value="">{t('filters.allStatuses')}</option>
        {APPLICATION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(`status.${status}`)}
          </option>
        ))}
      </select>
    </div>
  )
}
