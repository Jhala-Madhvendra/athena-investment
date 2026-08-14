import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import Sidebar from './components/shell/Sidebar'
import TopBar from './components/shell/TopBar'
import FinancialStatements from './components/FinancialStatements'
import FinancialStatementsGroup from './components/FinancialStatementsGroup'
import FinancialAnalysis from './components/FinancialAnalysis'
import BusinessAnalysis from './components/BusinessAnalysis'
import MarketIntelligence from './components/MarketIntelligence'
import Overview from './components/Overview'
import Valuation from './components/Valuation'
import AIResearch from './components/AIResearch'
import Watchlist from './components/Watchlist'
import Portfolio from './components/Portfolio'

/** Backward-compat redirect for the old flat statement URLs (pre-Sprint-5). */
function RedirectToStatement({ subtab }) {
  const { ticker } = useParams()
  return <Navigate to={`/financials/${ticker}/financial-statements/${subtab}`} replace />
}

function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex min-h-screen flex-col lg:pl-64">
          <TopBar onOpenNav={() => setMobileNavOpen(true)} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Routes>
              <Route path="/" element={<Navigate to="/financials/AAPL/overview" replace />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/financials/:ticker" element={<FinancialStatements />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<Overview />} />
                <Route path="financial-statements" element={<Navigate to="income-statement" replace />} />
                <Route path="financial-statements/:subtab" element={<FinancialStatementsGroup />} />
                <Route path="income-statement" element={<RedirectToStatement subtab="income-statement" />} />
                <Route path="balance-sheet" element={<RedirectToStatement subtab="balance-sheet" />} />
                <Route path="cash-flow" element={<RedirectToStatement subtab="cash-flow" />} />
                <Route path="financial-analysis" element={<FinancialAnalysis />} />
                <Route path="business-analysis" element={<Navigate to="overview" replace />} />
                <Route path="business-analysis/:subtab" element={<BusinessAnalysis />} />
                <Route path="market-intelligence" element={<MarketIntelligence />} />
                <Route path="valuation" element={<Navigate to="dcf" replace />} />
                <Route path="valuation/:subtab" element={<Valuation />} />
                <Route path="ai-research" element={<AIResearch />} />
              </Route>
              <Route path="*" element={<Navigate to="/financials/AAPL/overview" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
