import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import StatCard from './ui/StatCard'
import DCFSummary from './valuation/DCFSummary'
import MarketPriceComparison from './valuation/MarketPriceComparison'
import { fetchJson } from '../lib/api'
import { formatPercent, formatPerShare } from '../lib/compsFormat'
import { getSentimentTier } from '../lib/scoreTokens'

const formatCurrency = (value) =>
  typeof value === 'number' ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')

function PortfolioSnapshot({ payload }) {
  const { holdings = [], summary } = payload
  const returnTier = getSentimentTier(typeof summary?.totalReturnPercent === 'number' ? summary.totalReturnPercent >= 0 : null)

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Current Value" value={formatCurrency(summary.totalCurrentValue)} />
          <StatCard label="Cost Basis" value={formatCurrency(summary.totalCostBasis)} />
          <StatCard
            label="Gain/Loss"
            value={formatCurrency(summary.totalGainLoss)}
            hex={typeof summary.totalGainLoss === 'number' ? returnTier.hex : undefined}
          />
          <StatCard
            label="Return"
            value={formatPercent(summary.totalReturnPercent)}
            hex={typeof summary.totalReturnPercent === 'number' ? returnTier.hex : undefined}
          />
        </div>
      )}

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                <th className="px-5 py-3">Company</th>
                <th className="px-3 py-3">Shares</th>
                <th className="px-3 py-3">Current Price</th>
                <th className="px-3 py-3">Current Value</th>
                <th className="px-3 py-3">Gain/Loss</th>
                <th className="px-3 py-3">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {holdings.map((holding, index) => {
                const gainTier = getSentimentTier(typeof holding.returnPercent === 'number' ? holding.returnPercent >= 0 : null)
                return (
                  <tr key={`${holding.ticker}-${index}`}>
                    <td className="px-5 py-3 font-semibold text-ink">{holding.ticker}</td>
                    <td className="px-3 py-3 tabular-nums text-ink">{holding.shares}</td>
                    <td className="px-3 py-3 tabular-nums text-ink">{holding.priceUnavailable ? '—' : formatPerShare(holding.currentPrice, holding.currency)}</td>
                    <td className="px-3 py-3 tabular-nums text-ink">{holding.priceUnavailable ? '—' : formatCurrency(holding.currentValue)}</td>
                    <td className="px-3 py-3 tabular-nums" style={{ color: holding.priceUnavailable ? undefined : gainTier.hex }}>
                      {holding.priceUnavailable ? '—' : formatCurrency(holding.gainLoss)}
                    </td>
                    <td className="px-3 py-3 tabular-nums" style={{ color: holding.priceUnavailable ? undefined : gainTier.hex }}>
                      {formatPercent(holding.returnPercent)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function DcfSnapshot({ payload }) {
  return (
    <div className="space-y-6">
      {payload.ticker && <h2 className="text-xl font-bold tracking-tight text-ink">{payload.ticker} — DCF Valuation</h2>}
      <Card title="DCF Calculation">
        <DCFSummary result={payload} />
      </Card>
      <Card title="Market Price Comparison">
        <MarketPriceComparison
          currentMarketPrice={payload.currentMarketPrice}
          intrinsicValuePerShare={payload.intrinsicValuePerShare}
          upsideDownsidePercent={payload.upsideDownsidePercent}
          currency={payload.currency}
          disclaimer={payload.disclaimer}
        />
      </Card>
    </div>
  )
}

/**
 * Public, read-only view of a share link (GET /api/snapshots/shared/:token)
 * - no Sidebar/TopBar (see AppShell.jsx), no identity token required, no
 * edit actions. Renders exactly what was captured at share time, never
 * anything live - see snapshot.model.js for why.
 */
function SharedSnapshot() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchJson(`/api/snapshots/shared/${token}`, undefined, controller.signal)
        setSnapshot(data)
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [token])

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <header className="border-b border-border bg-surface-raised px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-ink">Shared from Athena Finance</p>
        <p className="text-xs text-ink-muted">A read-only snapshot - no account required to view.</p>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading && <Skeleton variant="card" count={1} />}

        {!loading && error && <ErrorState title="This link is no longer available" message={error} />}

        {!loading && !error && snapshot && (
          <div className="space-y-6">
            {snapshot.label && <h1 className="text-xl font-bold tracking-tight text-ink">{snapshot.label}</h1>}

            {snapshot.type === 'portfolio' && <PortfolioSnapshot payload={snapshot.payload} />}
            {snapshot.type === 'dcf' && <DcfSnapshot payload={snapshot.payload} />}

            <p className="text-xs text-ink-muted">
              Shared {formatDateTime(snapshot.createdAt)} - values are frozen as of that time, not live. Not investment
              advice.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default SharedSnapshot
