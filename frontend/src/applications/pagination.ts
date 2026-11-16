// Pure page <-> offset arithmetic. The URL speaks in pages (human: "page 3"),
// the API speaks in offsets ("skip 40 rows"); this module is the only place
// that converts between them.

export const PAGE_SIZE = 20

// Reads the `page` URL parameter. The URL is user-editable, so anything that is
// not a whole number >= 1 falls back to page 1 instead of breaking the screen:
// null (absent), "", "abc", "-2", "0", "1.5", "2abc", "1e3", absurdly large numbers.
export function parsePage(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1
  const page = Number(raw)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

// Rows to skip so that `page` starts at the right place: page 1 -> 0, page 3 -> 40.
export function pageToOffset(page: number, limit: number = PAGE_SIZE): number {
  return (page - 1) * limit
}

// An empty list still has ONE page (the empty one): never 0, so "page 1 of 0" cannot happen.
export function totalPages(total: number, limit: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / limit))
}

// A page past the end (deleted rows, hand-edited URL) is brought back to the last one.
export function clampPage(page: number, total: number, limit: number = PAGE_SIZE): number {
  return Math.min(page, totalPages(total, limit))
}
