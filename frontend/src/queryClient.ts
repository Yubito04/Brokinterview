import { QueryClient } from '@tanstack/react-query'

// Fabrique un client par appel : les tests en créent un neuf pour ne rien partager.
// retry: false — par défaut TanStack Query rejoue 3 fois avec attente, ce qui
// retarde l'affichage d'une erreur déjà traduite par notre client d'API.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}
