import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Without Vitest globals, React Testing Library cannot clean up by itself:
// remove what each test rendered so the next one starts on an empty page.
afterEach(() => {
  cleanup()
})
