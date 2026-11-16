import type { fr } from './fr'

// The shape of a dictionary: same nesting as the French one, every text a string.
// (Without this step, TypeScript would demand the exact French sentences.)
type ShapeOf<T> = { [K in keyof T]: T[K] extends string ? string : ShapeOf<T[K]> }

// Any other language is typed with this: a missing key, an extra key or a
// misspelled key is a compile error.
export type Messages = ShapeOf<typeof fr>
