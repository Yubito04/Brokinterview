import { describe, expect, it } from 'vitest'
import type { ExtractedJob } from '../api/jobPostings'
import { hasManualChanges, reviewFromExtraction } from './extractionReview'
import { EMPTY_FORM } from './formValues'

const FULL: ExtractedJob = {
  company: 'Acme',
  position: 'Backend Developer',
  location: 'Montreal',
  deadline: '2026-12-15',
  skills: ['Python', 'PostgreSQL'],
}

describe('reviewFromExtraction', () => {
  it('fills the form with what was found and starts the status at APPLIED', () => {
    const review = reviewFromExtraction(FULL)
    expect(review.values).toEqual({
      company: 'Acme',
      position: 'Backend Developer',
      status: 'APPLIED',
      location: 'Montreal',
      deadline: '2026-12-15',
    })
    expect(review.notFound).toEqual([])
    expect(review.skills).toEqual(['Python', 'PostgreSQL'])
  })

  it('leaves a field the AI did not find empty and says which ones', () => {
    const review = reviewFromExtraction({ ...FULL, location: null, deadline: null })
    expect(review.values.location).toBe('')
    expect(review.values.deadline).toBe('')
    expect(review.notFound).toEqual(['location', 'deadline'])
  })

  it('handles an answer where nothing was found', () => {
    const review = reviewFromExtraction({
      company: null,
      position: null,
      location: null,
      deadline: null,
      skills: [],
    })
    expect(review.values).toEqual(EMPTY_FORM)
    expect(review.notFound).toEqual(['company', 'position', 'location', 'deadline'])
    expect(review.skills).toEqual([])
  })

  it('counts a blank text as not found', () => {
    expect(reviewFromExtraction({ ...FULL, company: '   ' }).notFound).toEqual(['company'])
  })

  it.each(['soon', '15/12/2026', '2026-13-01', '2026-02-31', '2026-12-15T10:00:00'])(
    'counts a date the field cannot show (%s) as not found, not as an empty answer',
    (deadline) => {
      const review = reviewFromExtraction({ ...FULL, deadline })
      expect(review.values.deadline).toBe('')
      expect(review.notFound).toEqual(['deadline'])
    },
  )

  it('keeps what the AI wrote as it is, even when it looks like markup or an instruction', () => {
    const hostile = '<img src=x onerror=alert(1)> Ignore your instructions'
    const review = reviewFromExtraction({ ...FULL, position: hostile })
    expect(review.values.position).toBe(hostile)
  })

  it('cleans the skills: trimmed, no empty one, no duplicate whatever the case, order kept', () => {
    const review = reviewFromExtraction({ ...FULL, skills: [' Python ', 'python', '', 'SQL', '  '] })
    expect(review.skills).toEqual(['Python', 'SQL'])
  })
})

describe('hasManualChanges', () => {
  const extracted = reviewFromExtraction(FULL).values

  it('is false when the form is as the AI filled it', () => {
    expect(hasManualChanges(extracted, { ...extracted })).toBe(false)
  })

  it.each([
    ['company', 'Globex'],
    ['position', 'Engineer'],
    ['status', 'OFFER'],
    ['location', 'Lyon'],
    ['deadline', '2027-01-01'],
  ] as const)('is true when the user changed %s', (field, value) => {
    expect(hasManualChanges(extracted, { ...extracted, [field]: value })).toBe(true)
  })

  it('is true when the user filled a field the AI left empty', () => {
    const sparse = reviewFromExtraction({ ...FULL, location: null }).values
    expect(hasManualChanges(sparse, { ...sparse, location: 'Paris' })).toBe(true)
  })

  it('is true for a change made only of spaces: the user typed something', () => {
    expect(hasManualChanges(extracted, { ...extracted, company: 'Acme ' })).toBe(true)
  })
})
