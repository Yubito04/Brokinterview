import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { createI18n } from './i18n/createI18n.ts'
import { resources } from './i18n/resources.ts'
import { createQueryClient } from './queryClient.ts'

const queryClient = createQueryClient()
// The language comes from the stored choice, else the browser, else English.
const i18n = createI18n(resources)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </I18nextProvider>
  </StrictMode>,
)
