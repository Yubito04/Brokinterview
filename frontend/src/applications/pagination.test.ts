import { describe, expect, it } from 'vitest'
import { clampPage, pageToOffset, PAGE_SIZE, parsePage, totalPages } from './pagination'

describe('parsePage', () => {
  it('reads a valid page', () => {
    expect(parsePage('1')).toBe(1)
    expect(parsePage('3')).toBe(3)
    expect(parsePage('120')).toBe(120)
  })

  it.each([
    ['absent', null],
    ['empty', ''],
    ['text', 'abc'],
    ['zero', '0'],
    ['negative', '-2'],
    ['decimal', '1.5'],
    ['trailing text', '2abc'],
    ['exponent', '1e3'],
    ['plus sign', '+2'],
    ['spaces', ' 2 '],
    ['too large to be exact', '99999999999999999999'],
  ])('falls back to page 1 when the value is %s', (_label, raw) => {
    expect(parsePage(raw)).toBe(1)
  })
})

describe('pageToOffset', () => {
  it('starts page 1 at offset 0', () => {
    expect(pageToOffset(1)).toBe(0)
  })

  it('skips whole pages', () => {
    expect(pageToOffset(2)).toBe(PAGE_SIZE)
    expect(pageToOffset(3, 20)).toBe(40)
    expect(pageToOffset(4, 10)).toBe(30)
  })
})

describe('totalPages', () => {
  it('is 1, never 0, when the list is empty', () => {
    expect(totalPages(0)).toBe(1)
  })

  it('rounds up a partial last page', () => {
    expect(totalPages(1, 20)).toBe(1)
    expect(totalPages(21, 20)).toBe(2)
  })

  it('does not add a page when the total is an exact multiple', () => {
    expect(totalPages(20, 20)).toBe(1)
    expect(totalPages(40, 20)).toBe(2)
  })
})

describe('clampPage', () => {
  it('keeps a page that exists', () => {
    expect(clampPage(2, 40, 20)).toBe(2)
  })

  it('brings a page past the end back to the last one', () => {
    expect(clampPage(5, 45, 20)).toBe(3)
    expect(clampPage(3, 40, 20)).toBe(2)
  })

  it('stays on page 1 when the list is empty', () => {
    expect(clampPage(1, 0)).toBe(1)
    expect(clampPage(7, 0)).toBe(1)
  })
})
