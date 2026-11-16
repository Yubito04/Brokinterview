import { Route, Routes } from 'react-router'
import { ApplicationsPage } from './applications/ApplicationsPage'
import { ApplicationDetailPage } from './applications/ApplicationDetailPage'
import { EditApplicationPage } from './applications/EditApplicationPage'
import { ImportApplicationPage } from './applications/ImportApplicationPage'
import { NewApplicationPage } from './applications/NewApplicationPage'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'

function App() {
  return (
    <>
      {/* Always visible, whatever the screen. */}
      <header className="mx-auto flex max-w-4xl justify-end px-8 pt-4">
        <LanguageSwitcher />
      </header>
      <Routes>
        <Route path="/" element={<ApplicationsPage />} />
        <Route path="/applications/new" element={<NewApplicationPage />} />
        <Route path="/applications/import" element={<ImportApplicationPage />} />
        <Route path="/applications/:id" element={<ApplicationDetailPage />} />
        <Route path="/applications/:id/edit" element={<EditApplicationPage />} />
      </Routes>
    </>
  )
}

export default App
