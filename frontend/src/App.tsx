import { Route, Routes } from 'react-router'
import { ApplicationsPage } from './applications/ApplicationsPage'
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
      </Routes>
    </>
  )
}

export default App
