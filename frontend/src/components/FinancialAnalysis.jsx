import { useEffect, useState } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import EmptyState from './ui/EmptyState'

const formatRatioValue = (value, unit, currency) => {
  if (value === null || value === undefined) {
    return '—'
  }

  if (unit === 'percent') {
    return `${value.toFixed(2)}%`
  }

  if (unit === 'ratio') {
    return value.toFixed(2)
  }

  if (unit === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }

  return value.toString()
}

const ratioGroupLabels = {
  profitability: 'Profitability',
  liquidity: 'Liquidity',
  solvency: 'Solvency',
  cashFlow: 'Cash Flow',
  efficiency: 'Efficiency',
}

const ratioDescriptions = {
  grossMargin: 'Measures the percentage of revenue that remains after deducting cost of goods sold.',
  operatingMargin: 'Shows operating income as a share of revenue after operating expenses.',
  netProfitMargin: 'Indicates how much net income is generated from every dollar of revenue.',
  returnOnEquity: 'Measures profitability relative to shareholder equity.',
  returnOnAssets: 'Shows how efficiently assets generate profit.',
  currentRatio: 'Compares current assets to current liabilities for near-term liquidity.',
  quickRatio: 'Measures the ability to cover short-term obligations with liquid assets.',
  debtToEquity: 'Compares debt levels to shareholder equity to assess leverage.',
  debtRatio: 'Shows the portion of assets financed by debt.',
  freeCashFlow: 'Represents cash available after investing in capital expenditures.',
  assetTurnover: 'Measures how efficiently assets produce revenue.',
}

const buildCard = (key, metric, currency) => (
  <article key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-start justify-between gap-2">
      <h4 className="text-sm font-semibold text-slate-800">{metric.label}</h4>
      <span className="shrink-0 text-xs text-slate-400">{metric.available ? metric.unit : 'N/A'}</span>
    </div>
    <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
      {formatRatioValue(metric.value, metric.unit, currency)}
    </p>
    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
      {ratioDescriptions[key] || 'Derived from the most recent financial statements.'}
    </p>
  </article>
)

function FinancialAnalysis() {
  const { ticker } = useParams()
  const { currency } = useOutletContext()
  const [ratios, setRatios] = useState(null)
  const [year, setYear] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

    const loadRatios = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/ratios/${encodeURIComponent(ticker)}`,
          { signal: controller.signal },
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load financial analysis.')
        }

        setRatios(data.ratios || {})
        setYear(data.year || null)
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

    loadRatios()

    return () => controller.abort()
  }, [ticker])

  if (isLoading) {
    return <Skeleton variant="card" count={1} />
  }

  if (error) {
    return <ErrorState title="Couldn't load financial analysis" message={error} />
  }

  if (!ratios) {
    return <EmptyState title="No analysis available" message={`No financial analysis is available for ${ticker.toUpperCase()}.`} />
  }

  return (
    <section aria-labelledby="financial-analysis-title" className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Financial analysis</p>
        <h2 id="financial-analysis-title" className="mt-1 text-xl font-bold text-slate-900">
          Ratio analysis
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Latest ratios for {ticker.toUpperCase()} ({year || 'latest year'}).
        </p>
      </div>

      <div className="space-y-5">
        {Object.entries(ratios).map(([groupKey, groupMetrics]) => (
          <Card key={groupKey} title={ratioGroupLabels[groupKey]}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(groupMetrics).map(([metricKey, metric]) => buildCard(metricKey, metric, currency))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

export default FinancialAnalysis
