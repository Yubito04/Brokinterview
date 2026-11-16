// The API sends a date without time ("2026-11-20"). Shown in the language's own
// style: "20 nov. 2026" (fr), "Nov 20, 2026" (en).
// A date-only text is read as midnight UTC and formatted in UTC: formatting it in the
// reader's timezone would show the previous day west of Greenwich.
export function formatDeadline(deadline: string | null, language: string): string {
  if (!deadline) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline)
  if (!match) return deadline
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  // Date rolls "2026-02-31" over to March: such a text is not a real date, show it as is.
  if (date.getUTCMonth() !== month - 1) return deadline
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}
