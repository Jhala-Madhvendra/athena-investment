import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ExternalLink, ListPlus, Wallet, X, Bell } from 'lucide-react'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import EmptyState from './ui/EmptyState'
import SectionHeader from './ui/SectionHeader'
import StatCard from './ui/StatCard'
import PortfolioAnalyticsSection from './portfolio/PortfolioAnalyticsSection'
import ScenarioSection from './portfolio/scenario/ScenarioSection'
import TransactionsSection from './portfolio/TransactionsSection'
import { fetchJson } from '../lib/api'
import { formatPercent, formatPerShare } from '../lib/compsFormat'
import { getSentimentTier } from '../lib/scoreTokens'

const formatCurrency = (value, currency) => {
  if (typeof value !== 'number') return '—'
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${formatted} ${currency}` : `$${formatted}`
}

const toDateInputValue = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

const emptyFormValues = { ticker: '', shares: '', averagePurchasePrice: '', purchaseDate: '' }

/**
 * "Investments you own" - distinct from Watchlist's "companies you're
 * interested in" (see research/finance/WatchlistVsPortfolio.md). Every
 * price/value figure comes from GET /api/portfolio, which reuses
 * market.service for live prices and computes cost basis/gain/return in
 * backend/portfolio/portfolio.calculator.js - this page only formats and
 * displays, it never calculates.
 */
function Portfolio() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [holdings, setHoldings] = useState([])
  const [summary, setSummary] = useState(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingHolding, setEditingHolding] = useState(null)
  const [formValues, setFormValues] = useState(emptyFormValues)
  const [formError, setFormError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  const [deletingId, setDeletingId] = useState(null)
  const [rowError, setRowError] = useState('')
  const [watchlistState, setWatchlistState] = useState({})
  const [alertCounts, setAlertCounts] = useState({})

  // Bumped whenever TransactionsSection records/edits/deletes a transaction,
  // so PortfolioAnalyticsSection re-fetches - its server-side cache key
  // already accounts for the ledger changing, the frontend just needs a
  // reason to re-run the effect that calls it.
  const [transactionsVersion, setTransactionsVersion] = useState(0)

  const loadPortfolio = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchJson('/api/portfolio', undefined, signal)
      setHoldings(data.holdings)
      setSummary(data.summary)
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError(requestError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadPortfolio(controller.signal)
    return () => controller.abort()
  }, [])

  const tickerKey = [...new Set(holdings.map((h) => h.ticker))].join(',')

  /** One aggregate call for every held ticker's alert count - informational only, see Portfolio Integration in the sprint brief (no recommendations, just "N holdings require attention"). */
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      if (!tickerKey) {
        setAlertCounts({})
        return
      }
      try {
        const data = await fetchJson(`/api/alerts/counts?tickers=${encodeURIComponent(tickerKey)}`, undefined, controller.signal)
        setAlertCounts(data.counts || {})
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setAlertCounts({})
      }
    }
    load()
    return () => controller.abort()
  }, [tickerKey])

  const openAddForm = () => {
    setEditingHolding(null)
    setFormValues(emptyFormValues)
    setFormError('')
    setFormOpen(true)
  }

  const openEditForm = (holding) => {
    setEditingHolding(holding)
    setFormValues({
      ticker: holding.ticker,
      shares: String(holding.shares),
      averagePurchasePrice: String(holding.averagePurchasePrice),
      purchaseDate: toDateInputValue(holding.purchaseDate),
    })
    setFormError('')
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingHolding(null)
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    setFormSubmitting(true)
    setFormError('')

    const body = {
      shares: Number(formValues.shares),
      averagePurchasePrice: Number(formValues.averagePurchasePrice),
      purchaseDate: formValues.purchaseDate,
    }

    try {
      if (editingHolding) {
        await fetchJson(`/api/portfolio/holdings/${editingHolding._id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await fetchJson('/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({ ...body, ticker: formValues.ticker }),
        })
      }
      closeForm()
      await loadPortfolio()
    } catch (requestError) {
      setFormError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = async (holding) => {
    setDeletingId(holding._id)
    setRowError('')
    try {
      await fetchJson(`/api/portfolio/holdings/${holding._id}`, { method: 'DELETE' })
      await loadPortfolio()
    } catch (requestError) {
      setRowError(requestError.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddToWatchlist = async (ticker) => {
    setWatchlistState((prev) => ({ ...prev, [ticker]: 'adding' }))
    try {
      await fetchJson('/api/watchlist', { method: 'POST', body: JSON.stringify({ ticker }) })
      setWatchlistState((prev) => ({ ...prev, [ticker]: 'added' }))
    } catch (requestError) {
      // Already on the watchlist is not a failure worth surfacing here - just show it as added.
      setWatchlistState((prev) => ({ ...prev, [ticker]: requestError.status === 409 ? 'added' : 'error' }))
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Portfolio" description="Investments you own." />
        <Skeleton variant="card" count={1} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Portfolio" description="Investments you own." />
        <ErrorState title="Couldn't load your portfolio" message={error} />
      </div>
    )
  }

  const returnTier = getSentimentTier(
    typeof summary?.totalReturnPercent === 'number' ? summary.totalReturnPercent >= 0 : null
  )

  const addHoldingButton = (
    <button
      type="button"
      onClick={openAddForm}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Add Holding
    </button>
  )

  return (
    <div className="space-y-6">
      <SectionHeader title="Portfolio" description="Investments you own - cost basis, value, and gain/loss." action={addHoldingButton} />

      {Object.values(alertCounts).filter((count) => count > 0).length > 0 && (
        <Link
          to="/alerts"
          className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-ink-secondary transition-colors hover:bg-warning/20"
        >
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink">
                {Object.values(alertCounts).filter((count) => count > 0).length} holding
                {Object.values(alertCounts).filter((count) => count > 0).length === 1 ? '' : 's'}
              </span>{' '}
              require attention.
            </span>
          </span>
          <span className="shrink-0 font-medium text-brand-600">View Alerts →</span>
        </Link>
      )}

      {holdings.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No holdings yet"
          message="Add what you own to see cost basis, current value, and gain/loss - this is an analytical tracker, not a brokerage."
          action={addHoldingButton}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Current Value" value={formatCurrency(summary.totalCurrentValue)} />
            <StatCard label="Cost Basis" value={formatCurrency(summary.totalCostBasis)} />
            <StatCard
              label="Unrealized Gain/Loss"
              value={formatCurrency(summary.totalGainLoss)}
              hex={typeof summary.totalGainLoss === 'number' ? returnTier.hex : undefined}
            />
            <StatCard
              label="Return"
              value={formatPercent(summary.totalReturnPercent)}
              hex={typeof summary.totalReturnPercent === 'number' ? returnTier.hex : undefined}
            />
            <StatCard label="Holdings" value={summary.numberOfHoldings} sublabel={`${summary.numberOfCompanies} companies`} />
          </div>

          <Card title="Portfolio Intelligence" eyebrow="Analytical observations, not advice">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs font-medium text-ink-muted">Largest Holding</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {summary.largestHolding
                    ? `${summary.largestHolding.ticker} · ${formatPercent(summary.largestHolding.weightPercent)} of portfolio`
                    : 'Not enough priced holdings yet.'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Best Performing</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {summary.bestPerformingHolding
                    ? `${summary.bestPerformingHolding.ticker} · ${formatPercent(summary.bestPerformingHolding.returnPercent)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Worst Performing</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {summary.worstPerformingHolding
                    ? `${summary.worstPerformingHolding.ticker} · ${formatPercent(summary.worstPerformingHolding.returnPercent)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Concentration</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  Top holding: {formatPercent(summary.concentration.topHoldingWeightPercent)} · Top 3:{' '}
                  {formatPercent(summary.concentration.top3WeightPercent)}
                </dd>
              </div>
            </div>
            {summary.unpricedHoldings?.length > 0 && (
              <p className="mt-4 text-xs text-ink-muted">
                {summary.unpricedHoldings.length} holding(s) excluded from totals above - current price unavailable for{' '}
                {summary.unpricedHoldings.map((h) => h.ticker).join(', ')}.
              </p>
            )}
          </Card>

          {rowError && (
            <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{rowError}</p>
          )}

          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    <th className="px-5 py-3">Company</th>
                    <th className="px-3 py-3">Shares</th>
                    <th className="px-3 py-3">Average Cost</th>
                    <th className="px-3 py-3">Current Price</th>
                    <th className="px-3 py-3">Current Value</th>
                    <th className="px-3 py-3">Gain/Loss</th>
                    <th className="px-3 py-3">Return</th>
                    <th className="px-3 py-3">Weight</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holdings.map((holding) => {
                    const gainTier = getSentimentTier(
                      typeof holding.returnPercent === 'number' ? holding.returnPercent >= 0 : null
                    )
                    const wlState = watchlistState[holding.ticker]

                    return (
                      <tr key={holding._id} className="transition-colors hover:bg-surface-sunken/50">
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/financials/${encodeURIComponent(holding.ticker)}/overview`)}
                            className="font-semibold text-ink hover:underline"
                          >
                            {holding.ticker}
                          </button>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink">{holding.shares}</td>
                        <td className="px-3 py-3 tabular-nums text-ink">
                          {formatCurrency(holding.averagePurchasePrice, holding.currency)}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink">
                          {holding.priceUnavailable ? '—' : formatPerShare(holding.currentPrice, holding.currency)}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink">
                          {holding.priceUnavailable ? '—' : formatCurrency(holding.currentValue, holding.currency)}
                        </td>
                        <td className="px-3 py-3 tabular-nums" style={{ color: holding.priceUnavailable ? undefined : gainTier.hex }}>
                          {holding.priceUnavailable ? '—' : formatCurrency(holding.gainLoss, holding.currency)}
                        </td>
                        <td className="px-3 py-3 tabular-nums" style={{ color: holding.priceUnavailable ? undefined : gainTier.hex }}>
                          {formatPercent(holding.returnPercent)}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink">{formatPercent(holding.weightPercent)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleAddToWatchlist(holding.ticker)}
                              disabled={wlState === 'adding' || wlState === 'added'}
                              className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Add ${holding.ticker} to watchlist`}
                              title={wlState === 'added' ? 'On your watchlist' : 'Add to Watchlist'}
                            >
                              <ListPlus className={`h-4 w-4 ${wlState === 'added' ? 'text-brand-500' : ''}`} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/financials/${encodeURIComponent(holding.ticker)}/overview`)}
                              className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
                              aria-label={`Open ${holding.ticker} dashboard`}
                              title="Open Company Dashboard"
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditForm(holding)}
                              className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
                              aria-label={`Edit ${holding.ticker} holding`}
                              title="Edit holding"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(holding)}
                              disabled={deletingId === holding._id}
                              className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Delete ${holding.ticker} holding`}
                              title="Delete holding"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <PortfolioAnalyticsSection holdingsCount={holdings.length} transactionsVersion={transactionsVersion} />
          <ScenarioSection holdingsCount={holdings.length} />
        </>
      )}

      {/*
        Rendered regardless of whether the user has current Holding rows -
        the Transaction ledger is a separate, additive input (see
        TransactionsSection's header comment), so someone who's only ever
        recorded transactions (no Holding yet) must still be able to see
        and manage them here.
      */}
      <TransactionsSection onTransactionsChanged={() => setTransactionsVersion((v) => v + 1)} />

      <p className="text-xs text-ink-muted">
        This is an analytical tracker only - Athena does not connect to a brokerage, execute trades, or recommend
        buying or selling anything. Not investment advice.
      </p>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface-raised p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">{editingHolding ? 'Edit Holding' : 'Add Holding'}</h3>
              <button type="button" onClick={closeForm} className="rounded-md p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-3">
              {!editingHolding && (
                <div>
                  <label htmlFor="holding-ticker" className="mb-1 block text-xs font-medium text-ink-muted">
                    Ticker or company name
                  </label>
                  <input
                    id="holding-ticker"
                    type="text"
                    required
                    value={formValues.ticker}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, ticker: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label htmlFor="holding-shares" className="mb-1 block text-xs font-medium text-ink-muted">
                  Shares
                </label>
                <input
                  id="holding-shares"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formValues.shares}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, shares: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="holding-price" className="mb-1 block text-xs font-medium text-ink-muted">
                  Purchase price per share
                </label>
                <input
                  id="holding-price"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formValues.averagePurchasePrice}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, averagePurchasePrice: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="holding-date" className="mb-1 block text-xs font-medium text-ink-muted">
                  Purchase date
                </label>
                <input
                  id="holding-date"
                  type="date"
                  required
                  max={toDateInputValue(new Date().toISOString())}
                  value={formValues.purchaseDate}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, purchaseDate: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
              {formError && <p className="text-sm text-critical">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formSubmitting ? 'Saving…' : editingHolding ? 'Save Changes' : 'Add Holding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Portfolio
