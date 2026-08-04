import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import FinancialStatements from './components/FinancialStatements'
import './components/FinancialStatements.css'
import './App.css'

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

      navigate(`/financials/${encodeURIComponent(data.ticker)}`)
    } catch (resolveError) {
      setError(resolveError.message)
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <form className="ticker-search" onSubmit={handleSubmit}>
      <label htmlFor="ticker-input">Enter ticker or company name</label>
      <div className="ticker-search__controls">
        <input
          id="ticker-input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="AAPL, Apple Inc, Microsoft"
          aria-label="Search ticker or company name"
          disabled={isResolving}
        />
        <button type="submit" disabled={isResolving}>
          {isResolving ? 'Resolving...' : 'Load'}
        </button>
      </div>
      {error && <p className="ticker-search__error">{error}</p>}
    </form>
  )
}

function FinancialStatementsWrapper() {
  const { ticker } = useParams()

  return <FinancialStatements ticker={ticker || 'AAPL'} />
}

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <TickerSearch />
        <Routes>
          <Route path="/" element={<Navigate to="/financials/AAPL" replace />} />
          <Route path="/financials/:ticker" element={<FinancialStatementsWrapper />} />
          <Route path="*" element={<Navigate to="/financials/AAPL" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
