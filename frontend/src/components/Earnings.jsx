import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import EmptyState from './ui/EmptyState'
import NewsCard from './news/NewsCard'
import EarningsComparisonTable from './earnings/EarningsComparisonTable'
import EarningsQualitySection from './earnings/EarningsQualitySection'
import MarketReactionCard from './earnings/MarketReactionCard'
import EarningsAiSummarySection from './earnings/EarningsAiSummarySection'

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const fetchJson = async (url, signal) => {
  const response = await fetch(url, { signal })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Request failed.')
  }
  return data
}

/** Builds the comparison table's grouped rows from the API response - kept here (not in the table component) since it encodes which display type each metric needs, independent of the backend's own generic `unit` field. */
const buildGroups = (data) => [
  {
    title: 'Growth',
    rows: [
      { key: 'revenue', label: 'Revenue', type: 'currency', metric: data.growth?.revenue, signal: data.signals?.growth?.revenue },
      {
        key: 'operatingIncome',
        label: 'Operating Income',
        type: 'currency',
        metric: data.growth?.operatingIncome,
        signal: data.signals?.growth?.operatingIncome,
      },
      { key: 'netIncome', label: 'Net Income', type: 'currency', metric: data.growth?.netIncome, signal: data.signals?.growth?.netIncome },
    ],
  },
  {
    title: 'Profitability',
    rows: [
      {
        key: 'operatingMargin',
        label: 'Operating Margin',
        type: 'percent',
        metric: data.profitability?.operatingMargin,
        signal: data.signals?.profitability?.operatingMargin,
      },
      {
        key: 'netMargin',
        label: 'Net Profit Margin',
        type: 'percent',
        metric: data.profitability?.netMargin,
        signal: data.signals?.profitability?.netMargin,
      },
      {
        key: 'returnOnEquity',
        label: 'Return on Equity (ROE)',
        type: 'percent',
        metric: data.profitability?.returnOnEquity,
        signal: data.signals?.profitability?.returnOnEquity,
      },
      {
        key: 'returnOnAssets',
        label: 'Return on Assets (ROA)',
        type: 'percent',
        metric: data.profitability?.returnOnAssets,
        signal: data.signals?.profitability?.returnOnAssets,
      },
    ],
  },
  {
    title: 'Cash Flow',
    rows: [
      {
        key: 'freeCashFlow',
        label: 'Free Cash Flow',
        type: 'currency',
        metric: data.cashFlow?.freeCashFlow,
        signal: data.signals?.cashFlow?.freeCashFlow,
      },
      { key: 'fcfMargin', label: 'FCF Margin', type: 'percent', metric: data.cashFlow?.fcfMargin, signal: data.signals?.cashFlow?.fcfMargin },
    ],
  },
  {
    title: 'Balance Sheet',
    rows: [
      {
        key: 'totalDebt',
        label: 'Total Debt',
        type: 'currency',
        metric: data.balanceSheet?.totalDebt,
        signal: data.signals?.balanceSheet?.totalDebt,
      },
      { key: 'cash', label: 'Cash & Equivalents', type: 'currency', metric: data.balanceSheet?.cash, signal: data.signals?.balanceSheet?.cash },
      { key: 'netDebt', label: 'Net Debt', type: 'currency', metric: data.balanceSheet?.netDebt, signal: data.signals?.balanceSheet?.netDebt },
    ],
  },
  {
    title: 'Per Share',
    rows: [
      { key: 'basicEPS', label: 'Basic EPS', type: 'eps', metric: data.perShare?.basicEPS, signal: null },
      { key: 'dilutedEPS', label: 'Diluted EPS', type: 'eps', metric: data.perShare?.dilutedEPS, signal: null },
    ],
  },
]

/**
 * Earnings Intelligence tab: how the company performed in its latest
 * reported period vs. the prior one, deterministically. Every number here
 * comes straight from GET /api/earnings/:ticker (backend/earnings/) - this
 * component only formats and lays it out, it computes nothing itself.
 */
function Earnings() {
  const { ticker } = useParams()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const result = await fetchJson(`${apiBaseUrl}/api/earnings/${encodeURIComponent(ticker)}`, controller.signal)
        setData(result)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setData(null)
          setError(requestError.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    load()
    return () => controller.abort()
  }, [ticker])

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton variant="card" count={1} />
        <Skeleton variant="table" count={6} />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Couldn't load earnings intelligence" message={error} />
  }

  if (!data) {
    return (
      <EmptyState
        title="No earnings data available"
        message={`No financial statements have been imported for ${ticker?.toUpperCase()} yet.`}
      />
    )
  }

  const { period, qualityObservations, cashFlow, marketReaction, relatedNews } = data

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">Earnings Intelligence</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {period.latestPeriod} for {ticker?.toUpperCase()}
          {period.comparisonAvailable ? ` compared with ${period.previousPeriod} (${period.comparisonType}).` : ' - no prior period is available for comparison yet.'}
        </p>
      </div>

      <Card title="Performance Summary" eyebrow={data.dataFreshness?.statementType}>
        <EarningsComparisonTable groups={buildGroups(data)} latestLabel={period.latestPeriod} previousLabel={period.previousPeriod} />
      </Card>

      <EarningsAiSummarySection ticker={ticker} fiscalYearKey={period.latestPeriod} />

      <Card title="Earnings Quality">
        <EarningsQualitySection observations={qualityObservations} fcfConversion={cashFlow?.fcfConversion} />
      </Card>

      <Card title="Market Reaction">
        <MarketReactionCard marketReaction={marketReaction} />
      </Card>

      <Card title="Related Earnings News">
        {relatedNews && relatedNews.length > 0 ? (
          <div className="space-y-3">
            {relatedNews.map((article) => (
              <NewsCard key={article.url} article={article} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No earnings-related news has been retrieved for {ticker?.toUpperCase()} yet.</p>
        )}
      </Card>
    </div>
  )
}

export default Earnings
