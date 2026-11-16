// The API sends a date as "2026-11-20"; shown as "20/11/2026". Done on the text
// (not through Date) so that no timezone can shift the day.
export function formatDeadline(deadline: string | null): string {
  if (!deadline) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : deadline
}
