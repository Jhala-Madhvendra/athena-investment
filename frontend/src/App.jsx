import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import FinancialStatements from './components/FinancialStatements'
import StatementTable from './components/StatementTable'
import FinancialAnalysis from './components/FinancialAnalysis'
import BusinessAnalysis from './components/BusinessAnalysis'
import MarketIntelligence from './components/MarketIntelligence'

function TickerSearch() {
  const [query, setQuery] = useState('AAPL')
  const [error, setError] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
      setError('Enter a company ticker or name.')
      return
    }

    setError('')
    setIsResolving(true)

    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/company/resolve?q=${encodeURIComponent(normalizedQuery)}`
      )
      const rawText = await response.text()
      let data

      try {
        data = rawText ? JSON.parse(rawText) : {}
      } catch {
        throw new Error(rawText || 'Unable to resolve company.')
      }

      if (!response.ok) {
        throw new Error(data.message || 'Unable to resolve company.')
      }

      navigate(`/financials/${encodeURIComponent(data.ticker)}/income-statement`)
    } catch (resolveError) {
      setError(resolveError.message)
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <form className="flex flex-1 items-center gap-2" onSubmit={handleSubmit}>
      <label htmlFor="ticker-input" className="sr-only">
        Enter ticker or company name
      </label>
      <input
        id="ticker-input"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search ticker or company (AAPL, Wipro, Eternal…)"
        aria-label="Search ticker or company name"
        disabled={isResolving}
        className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={isResolving}
        className="shrink-0 rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isResolving ? 'Loading…' : 'Load'}
      </button>
      {error && <p className="hidden text-xs font-medium text-critical sm:block">{error}</p>}
    </form>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
            <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
              <path d="M8 9.5 L5.5 4 L11 8 Z" fill="#fff" />
              <path d="M24 9.5 L26.5 4 L21 8 Z" fill="#fff" />
              <path
                d="M16 6c-4.7 0-8.5 3.8-8.5 8.5 0 3.7 2.4 6.8 5.7 8L11.8 27c-.2.6.4 1.1.9.8l3-1.8c.2 0 .2 0 .3 0l3 1.8c.6.3 1.2-.2.9-.8l-1.4-4.5c3.3-1.2 5.7-4.3 5.7-8C24.5 9.8 20.7 6 16 6z"
                fill="#fff"
              />
              <circle cx="12" cy="14.3" r="3.1" fill="#256abf" />
              <circle cx="20" cy="14.3" r="3.1" fill="#256abf" />
              <circle cx="12" cy="14.3" r="1.3" fill="#fff" />
              <circle cx="20" cy="14.3" r="1.3" fill="#fff" />
              <path d="M16 16.8 L14.3 19.2 L17.7 19.2 Z" fill="#cde2fb" />
            </svg>
          </span>
          <span className="text-base font-semibold text-slate-900">Athena Finance</span>
        </a>
        <TickerSearch />
      </div>
    </header>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/financials/AAPL/income-statement" replace />} />
            <Route path="/financials/:ticker" element={<FinancialStatements />}>
              <Route index element={<Navigate to="income-statement" replace />} />
              <Route path="income-statement" element={<StatementTable statementKey="incomeStatement" />} />
              <Route path="balance-sheet" element={<StatementTable statementKey="balanceSheet" />} />
              <Route path="cash-flow" element={<StatementTable statementKey="cashFlow" />} />
              <Route path="financial-analysis" element={<FinancialAnalysis />} />
              <Route path="business-analysis" element={<Navigate to="overview" replace />} />
              <Route path="business-analysis/:subtab" element={<BusinessAnalysis />} />
              <Route path="market-intelligence" element={<MarketIntelligence />} />
            </Route>
            <Route path="*" element={<Navigate to="/financials/AAPL/income-statement" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
