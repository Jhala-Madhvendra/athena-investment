import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/shell/AppShell'
import SharedSnapshot from './components/SharedSnapshot'

/**
 * Top-level route split: /share/:token is public (no Sidebar/TopBar, no
 * assumption of an Athena account) and everything else renders inside
 * AppShell, the authenticated app's nav + route tree. See AppShell.jsx for
 * why this split exists.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/share/:token" element={<SharedSnapshot />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
