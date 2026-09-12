import { useEffect, useState } from 'react'
import { Download, Landmark } from 'lucide-react'
import Card from '../ui/Card'
import Skeleton from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'
import SectionHeader from '../ui/SectionHeader'
import Badge from '../ui/Badge'
import { fetchJson } from '../../lib/api'
import { downloadCsv } from '../../lib/csvExport'

const formatCurrency = (value) => {
  if (typeof value !== 'number') return '—'
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '—')

/**
 * FIFO-matched realized gains (with CSV export - item 10's "export" half)
 * and remaining open lots. Built on Transaction, never Holding - see
 * taxLot.calculator.js. `term`/gain figures are informational estimates,
 * never a tax filing claim - see ProductBoundaries.md.
 */
function TaxLotsSection({ portfolioId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [realized, setRealized] = useState(null)
  const [openLots, setOpenLots] = useState([])

  useEffect(() => {
    if (!portfolioId) return undefined
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [realizedData, openData] = await Promise.all([
          fetchJson(`/api/portfolio/tax-lots/realized?portfolioId=${encodeURIComponent(portfolioId)}`, undefined, controller.signal),
          fetchJson(`/api/portfolio/tax-lots/open?portfolioId=${encodeURIComponent(portfolioId)}`, undefined, controller.signal),
        ])
        setRealized(realizedData)
        setOpenLots(openData.openLots || [])
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [portfolioId])

  const handleDownloadCsv = () => {
    downloadCsv(
      'realized-gains.csv',
      realized.realizedLots.map((lot) => ({
        Ticker: lot.ticker,
        'Buy Date': formatDate(lot.buyDate),
        'Sell Date': formatDate(lot.sellDate),
        Quantity: lot.quantity,
        'Buy Price': lot.buyPrice,
        'Sell Price': lot.sellPrice,
        Proceeds: lot.proceeds,
        'Cost Basis': lot.costBasis,
        'Gain/Loss': lot.gainLoss,
        Term: lot.term,
      }))
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Tax Lots" description="FIFO-matched realized gains and remaining open lots." />
        <Skeleton variant="card" count={1} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Tax Lots" description="FIFO-matched realized gains and remaining open lots." />
        <ErrorState title="Couldn't load tax lots" message={error} />
      </div>
    )
  }

  const hasRealized = realized?.realizedLots?.length > 0
  const hasOpen = openLots.length > 0

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tax Lots"
        description="FIFO-matched realized gains and remaining open lots, estimated for informational purposes - not tax advice."
        action={
          hasRealized && (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download CSV
            </button>
          )
        }
      />

      <div>
        <h4 className="mb-2 text-sm font-semibold text-ink">Realized Gains</h4>
        {!hasRealized ? (
          <EmptyState icon={Landmark} title="No realized gains yet" message="Record a SELL transaction to see FIFO-matched realized gains here." />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatMini label="Total Realized" value={formatCurrency(realized.summary.totalRealizedGain)} />
              <StatMini label="Short-Term" value={formatCurrency(realized.summary.shortTermGain)} />
              <StatMini label="Long-Term" value={formatCurrency(realized.summary.longTermGain)} />
            </div>
            <Card padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                      <th className="px-5 py-3">Company</th>
                      <th className="px-3 py-3">Buy Date</th>
                      <th className="px-3 py-3">Sell Date</th>
                      <th className="px-3 py-3">Quantity</th>
                      <th className="px-3 py-3">Gain/Loss</th>
                      <th className="px-3 py-3">Term</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {realized.realizedLots.map((lot, index) => (
                      <tr key={`${lot.ticker}-${lot.buyDate}-${lot.sellDate}-${index}`} className="transition-colors hover:bg-surface-sunken/50">
                        <td className="px-5 py-3 font-semibold text-ink">{lot.ticker}</td>
                        <td className="px-3 py-3 tabular-nums text-ink">{formatDate(lot.buyDate)}</td>
                        <td className="px-3 py-3 tabular-nums text-ink">{formatDate(lot.sellDate)}</td>
                        <td className="px-3 py-3 tabular-nums text-ink">{lot.quantity}</td>
                        <td className="px-3 py-3 tabular-nums text-ink">{formatCurrency(lot.gainLoss)}</td>
                        <td className="px-3 py-3">
                          <Badge tone={lot.term === 'LONG' ? 'good' : 'neutral'}>{lot.term}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-ink">Open Lots</h4>
        {!hasOpen ? (
          <p className="text-sm text-ink-muted">No open lots from recorded transactions.</p>
        ) : (
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    <th className="px-5 py-3">Company</th>
                    <th className="px-3 py-3">Buy Date</th>
                    <th className="px-3 py-3">Quantity</th>
                    <th className="px-3 py-3">Cost Basis</th>
                    <th className="px-3 py-3">Current Value</th>
                    <th className="px-3 py-3">Unrealized Gain/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openLots.map((lot, index) => (
                    <tr key={`${lot.ticker}-${lot.buyDate}-${index}`} className="transition-colors hover:bg-surface-sunken/50">
                      <td className="px-5 py-3 font-semibold text-ink">{lot.ticker}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{formatDate(lot.buyDate)}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{lot.quantityRemaining}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{formatCurrency(lot.costBasis)}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{lot.currentValue === null ? '—' : formatCurrency(lot.currentValue)}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">
                        {lot.unrealizedGainLoss === null ? '—' : formatCurrency(lot.unrealizedGainLoss)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatMini({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-3 py-2">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  )
}

export default TaxLotsSection
