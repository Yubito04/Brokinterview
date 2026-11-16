import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { useT } from '../i18n/useT'
import { useDebouncedValue } from './useDebouncedValue'

export const SEARCH_DEBOUNCE_MS = 300

type Props = {
  // The search currently in the URL.
  value: string
  onSearch: (value: string) => void
}

export function SearchBox({ value, onSearch }: Props) {
  const t = useT()
  const id = useId()
  // What is typed right now. It moves on every keystroke; the URL only follows
  // once the typing pauses (debounce).
  const [draft, setDraft] = useState(value)
  const debounced = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS)
  // The last value this component itself sent to the URL.
  const lastSent = useRef(value)

  // useEffectEvent: always calls the latest onSearch, without making the effect
  // below re-run each time the parent passes a new function.
  const sendSearch = useEffectEvent(onSearch)
  useEffect(() => {
    if (debounced !== lastSent.current) {
      lastSent.current = debounced
      sendSearch(debounced)
    }
  }, [debounced])

  // A change of `value` that we did NOT send (Back button, edited URL) must be
  // shown in the field. One that we sent ourselves must not overwrite what the
  // user typed since (e.g. "ab" reaches the URL while they already typed "abc").
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value
      setDraft(value)
    }
  }, [value])

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {t('filters.searchLabel')}
      </label>
      <input
        id={id}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="rounded border border-gray-400 px-2 py-1.5"
      />
    </div>
  )
}
