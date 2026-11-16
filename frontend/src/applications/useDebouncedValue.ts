import { useEffect, useState } from 'react'

// Follows `value`, but only after it has stopped changing for `delayMs`.
// Each change restarts the wait, so fast typing produces one update at the end.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
