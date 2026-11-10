// The API address comes from frontend/.env (VITE_API_URL), never written in the code.
// Vite copies it into the built code: it is public, so it must hold no secret.
const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error('VITE_API_URL is missing: copy .env.example to .env')
}

// No trailing slash, so that `${API_URL}/health` is always well formed.
export const API_URL = apiUrl.replace(/\/+$/, '')
