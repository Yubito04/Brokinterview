import { Route, Routes } from 'react-router'
import { ApplicationsPage } from './applications/ApplicationsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<ApplicationsPage />} />
    </Routes>
  )
}

export default App
