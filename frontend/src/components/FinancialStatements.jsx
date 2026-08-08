import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import Tabs from './ui/Tabs'
import Skeleton from './ui/Skeleton'
import EmptyState from './ui/EmptyState'
import ErrorState from './ui/ErrorState'

const TAB_ITEMS = [
  { key: 'income-statement', label: 'Income Statement', to: 'income-statement' },
  { key: 'balance-sheet', label: 'Balance Sheet', to: 'balance-sheet' },
  { key: 'cash-flow', label: 'Cash Flow', to: 'cash-flow' },
  { key: 'financial-analysis', label: 'Financial Analysis', to: 'financial-analysis' },
  { key: 'business-analysis', label: 'Business Analysis', to: 'business-analysis' },
]

function FinancialStatements() {
  const { ticker } = useParams()
  const [financialStatements, setFinancialStatements] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

    const loadFinancialStatements = async () => {
      setIsLoading(true)
      setError('')

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
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message)
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

      {!isLoading && error && (
        <ErrorState title="Couldn't load financial statements" message={error} />
      )}

      {!isLoading && !error && financialStatements.length === 0 && (
        <EmptyState
          title="No data yet"
          message={`No financial statements have been imported for ${ticker?.toUpperCase()} yet.`}
        />
      )}

      {!isLoading && !error && financialStatements.length > 0 && (
        <Outlet context={{ financialStatements, ticker }} />
      )}
    </section>
  )
}

export default FinancialStatements
