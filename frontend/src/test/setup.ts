import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy* and waitFor give up after 1 s by default. Screens tested through the whole App
// (typing, routing, several renders) can take longer on a busy machine: two such tests
// failed once each in about 25 full runs and passed every time again. A longer limit
// only changes how long a FAILING test waits, never what a passing one checks.
configure({ asyncUtilTimeout: 3000 })

// Without Vitest globals, React Testing Library cannot clean up by itself:
// remove what each test rendered so the next one starts on an empty page.
afterEach(() => {
  cleanup()
  // A language chosen in one test must not be remembered by the next one.
  localStorage.clear()
})
