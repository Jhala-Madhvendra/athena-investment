import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import Tabs from './ui/Tabs'
import Skeleton from './ui/Skeleton'

const TAB_ITEMS = [
  { key: 'overview', label: 'Overview', to: 'overview' },
  { key: 'financial-statements', label: 'Financial Statements', to: 'financial-statements' },
  { key: 'financial-analysis', label: 'Financial Analysis', to: 'financial-analysis' },
  { key: 'market-intelligence', label: 'Market Intelligence', to: 'market-intelligence' },
  { key: 'valuation', label: 'Valuation (Coming Soon)', to: 'valuation' },
]

function FinancialStatements() {
  const { ticker } = useParams()
  const [financialStatements, setFinancialStatements] = useState([])
  const [currency, setCurrency] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  // Fetch failure here (e.g. a company with no statements available at all,
  // like an ETF) is passed down rather than blocking the page - only
  // StatementTable actually requires this data; Overview, Market
  // Intelligence, Financial Analysis, and Business Analysis fetch their own
  // data independently and stay reachable regardless of this outcome.
  const [financialStatementsError, setFinancialStatementsError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

    const loadFinancialStatements = async () => {
      setIsLoading(true)
      setFinancialStatementsError('')

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/financials/${encodeURIComponent(ticker)}`,
          { signal: controller.signal },
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load financial statements.')
        }

        setFinancialStatements(data.financialStatements || [])
        setCurrency(data.currency || null)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setFinancialStatements([])
          setFinancialStatementsError(requestError.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadFinancialStatements()

    return () => controller.abort()
  }, [ticker])

  return (
    <section aria-labelledby="financial-statements-title" className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Company analysis</p>
        <h1 id="financial-statements-title" className="mt-1 text-3xl font-bold text-slate-900">
          {ticker?.toUpperCase()}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Annual reported figures and automated business analysis</p>
      </div>

      <Tabs items={TAB_ITEMS} />

      {isLoading && <Skeleton variant="card" count={1} />}

      {!isLoading && (
        <Outlet context={{ financialStatements, ticker, currency, financialStatementsError }} />
      )}
    </section>
  )
}

export default FinancialStatements
