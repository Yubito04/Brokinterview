import { API_URL } from '../config'
import { createApiClient } from './client'

// The one client the whole app shares, pointed at the address from frontend/.env.
export const api = createApiClient({ baseUrl: API_URL })
export { ApiError } from './errors'
export { EXTRACTION_TIMEOUT_MS } from './client'
