// Tells TypeScript which VITE_ variables exist (they come from frontend/.env).
interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
