import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // The tests read the API contract (../backend/openapi.json), which is outside this
  // folder: Vite refuses files outside its root unless they are allowed. ONLY in test
  // mode: for `npm run dev` the same setting would let the dev server serve any file of
  // the repository (backend/.env, with the API key) to whoever reaches it.
  server: mode === 'test' ? { fs: { allow: ['..'] } } : {},
  test: {
    // The screens are rendered in a fake browser (jsdom) by the component tests.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Fixed here so the tests do not depend on a developer's local frontend/.env.
    env: { VITE_API_URL: 'http://api.test' },
  },
}))
