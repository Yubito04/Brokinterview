// A short confirmation passed to the list screen through the router's navigation state
// ("created", "updated"). Not in the URL: it must not be shareable or bookmarked.
export const NOTICE_STATE_KEY = 'notice'
export type Notice = 'created' | 'updated'

export function readNotice(state: unknown): Notice | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const value = (state as Record<string, unknown>)[NOTICE_STATE_KEY]
  return value === 'created' || value === 'updated' ? value : undefined
}
