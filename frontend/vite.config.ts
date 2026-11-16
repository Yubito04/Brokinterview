import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // The screens are rendered in a fake browser (jsdom) by the component tests.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Fixed here so the tests do not depend on a developer's local frontend/.env.
    env: { VITE_API_URL: 'http://api.test' },
  },
})
