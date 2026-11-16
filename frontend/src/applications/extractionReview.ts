import type { ExtractedJob } from '../api/jobPostings'
import { EMPTY_FORM, type FormValues } from './formValues'

// The fields the AI can fill (the status is not one of them: a new application starts APPLIED).
export type ExtractedField = 'company' | 'position' | 'location' | 'deadline'
const EXTRACTED_FIELDS: readonly ExtractedField[] = ['company', 'position', 'location', 'deadline']

export type ExtractionReview = {
  // What goes into the form for the user to check and correct.
  values: FormValues
  // The fields the AI did not find: "not in the posting" is a valid answer, and it must be
  // told apart from a field the user simply has not filled in yet.
  notFound: ExtractedField[]
  // Shown to help the review, never saved (no column for them yet).
  skills: string[]
}

// "2026-12-15" and a real day: what <input type="date"> can display. Anything else would
// show as an EMPTY field while the AI did answer something, so it counts as "not found".
function isUsableDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

// Case-insensitive, first spelling kept, order kept: ["Python", "python", " SQL "] gives ["Python", "SQL"].
function cleanSkills(skills: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const skill of skills) {
    const text = skill.trim()
    if (text === '' || seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    result.push(text)
  }
  return result
}

// The AI's answer, as a starting point for the form. Nothing is validated or corrected
// here: what the model said is shown as it is (as text, never as HTML), and the server
// has the last word when the application is created.
export function reviewFromExtraction(job: ExtractedJob): ExtractionReview {
  const values: FormValues = { ...EMPTY_FORM }
  const notFound: ExtractedField[] = []

  for (const field of EXTRACTED_FIELDS) {
    const found = job[field]
    const usable = typeof found === 'string' && found.trim() !== '' && (field !== 'deadline' || isUsableDate(found))
    if (usable) values[field] = found
    else notFound.push(field)
  }
  return { values, notFound, skills: cleanSkills(job.skills) }
}

// Did the user change anything by hand since the form was filled from the AI's answer?
// Asked before a new extraction would overwrite the form.
export function hasManualChanges(extracted: FormValues, current: FormValues): boolean {
  return (Object.keys(extracted) as (keyof FormValues)[]).some(
    (field) => extracted[field] !== current[field],
  )
}
