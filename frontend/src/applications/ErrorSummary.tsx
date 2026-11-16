import type { RefObject } from 'react'
import { useT } from '../i18n/useT'

type SummaryProps = { summaryRef: RefObject<HTMLDivElement | null>; messages: string[] }

// The block above a form that lists what is not about one field.
export function ErrorSummary({ summaryRef, messages }: SummaryProps) {
  const t = useT()
  if (messages.length === 0) return null
  return (
    <div
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
      className="rounded border border-red-700 p-3 text-red-700"
    >
      <p className="font-medium">{t('form.saveFailed')}</p>
      <ul className="list-inside list-disc">
        {messages.map((text, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
    </div>
  )
}
