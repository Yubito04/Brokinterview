import { useEffect, useState } from 'react'
import { api } from './api'

// The three situations the screen can be in: waiting, answered, or failed.
type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' })

  // Runs once, after the first display: asks the API if it is alive.
  useEffect(() => {
    api
      .request<{ status: string }>('/health')
      .then((body) =>
        setHealth(body.status === 'ok' ? { kind: 'ok' } : { kind: 'error', message: 'Unexpected answer' }),
      )
      .catch((error: Error) => setHealth({ kind: 'error', message: error.message }))
  }, [])

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-3xl font-bold">ApplyFlow AI</h1>
      <p className="mt-4">
        {health.kind === 'loading' && 'Connecting to the API…'}
        {health.kind === 'ok' && <span className="text-green-700">API reachable ✔</span>}
        {health.kind === 'error' && (
          <span className="text-red-700">API unreachable: {health.message}</span>
        )}
      </p>
    </main>
  )
}

export default App
