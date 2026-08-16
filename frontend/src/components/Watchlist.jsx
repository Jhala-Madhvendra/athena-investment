import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ExternalLink, Search, ListPlus, Sparkles, Bell } from 'lucide-react'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import EmptyState from './ui/EmptyState'
import SectionHeader from './ui/SectionHeader'
import Badge from './ui/Badge'
import { fetchJson } from '../lib/api'
import { formatPercent, formatPerShare } from '../lib/compsFormat'
import { getScoreTier, getSentimentTier } from '../lib/scoreTokens'
import { formatRelativeTime } from '../lib/newsFormat'

const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

/**
 * "My Watchlist" - the answer to "what has changed in the companies I care
 * about" rather than "what do I need to know about this company" (that's
 * the per-ticker dashboard). Every metric column is fetched from an
 * existing Athena engine via GET /api/watchlist - this page computes
 * nothing itself, only formats and colors what the backend already
 * calculated. See research/product/WatchlistAndPortfolioProductDesign.md.
 */
function Watchlist() {
  const navigate = useNavigate()
  const addInputRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [watchlist, setWatchlist] = useState({ name: 'My Watchlist', companies: [] })
  const [search, setSearch] = useState('')

  const [addValue, setAddValue] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const [removingTicker, setRemovingTicker] = useState(null)
  const [removeError, setRemoveError] = useState('')

  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')

  const [alertCounts, setAlertCounts] = useState({})

  const loadWatchlist = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchJson('/api/watchlist', undefined, signal)
      setWatchlist(data.watchlist)
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError(requestError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = () => loadWatchlist(controller.signal)
    load()
    return () => controller.abort()
  }, [])

  const tickerKey = (watchlist.companies || []).map((c) => c.ticker).join(',')

  /** One aggregate call for every tracked ticker's alert count - see backend/alerts/alert.repository.js's countByTicker. Compact indicator only, never full alert messages here (see Watchlist Integration in the sprint brief). */
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

  const handleAdd = async (event) => {
    event.preventDefault()
    const query = addValue.trim()
    if (!query) {
      setAddError('Enter a ticker or company name.')
      return
    }

    setAddLoading(true)
    setAddError('')
    try {
      await fetchJson('/api/watchlist', { method: 'POST', body: JSON.stringify({ ticker: query }) })
      setAddValue('')
      await loadWatchlist()
    } catch (requestError) {
      setAddError(requestError.message)
    } finally {
      setAddLoading(false)
    }
  }

  const handleRemove = async (ticker) => {
    setRemovingTicker(ticker)
    setRemoveError('')
    try {
      await fetchJson(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: 'DELETE' })
      await loadWatchlist()
    } catch (requestError) {
      setRemoveError(requestError.message)
    } finally {
      setRemovingTicker(null)
    }
  }

  const focusAddInput = () => addInputRef.current?.focus()

  /**
   * A deliberate action, not something that fires on every page load - each
   * call is also a checkpoint that overwrites the "last seen" snapshot on
   * the backend, so auto-firing this on mount would silently consume the
   * comparison before the user ever saw it. See watchlistInsights.service.js.
   */
  const handleCheckInsights = async () => {
    setInsightsLoading(true)
    setInsightsError('')
    try {
      const data = await fetchJson('/api/watchlist/insights')
      setInsights(data.insights)
    } catch (requestError) {
      setInsightsError(requestError.message)
    } finally {
      setInsightsLoading(false)
    }
  }

  const addForm = (
    <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
      <input
        ref={addInputRef}
        type="text"
        value={addValue}
        onChange={(event) => {
          setAddValue(event.target.value)
          setAddError('')
        }}
        placeholder="Ticker or company name"
        aria-label="Ticker or company name to add"
        className="w-48 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
      />
      <button
        type="submit"
        disabled={addLoading}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {addLoading ? 'Adding…' : 'Add to Watchlist'}
      </button>
    </form>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Watchlist" description="Companies you're tracking." />
        <Skeleton variant="card" count={1} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Watchlist" description="Companies you're tracking." />
        <ErrorState title="Couldn't load your watchlist" message={error} />
      </div>
    )
  }

  const companies = watchlist.companies || []
  const filteredCompanies = search.trim()
    ? companies.filter((company) => {
        const needle = search.trim().toLowerCase()
        return company.ticker.toLowerCase().includes(needle) || company.name?.toLowerCase().includes(needle)
      })
    : companies

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Watchlist"
        description="Companies you're tracking - see what's changed since you last checked."
        action={addForm}
      />

      {addError && (
        <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{addError}</p>
      )}
      {removeError && (
        <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{removeError}</p>
      )}

      {companies.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Your watchlist is empty"
          message="Track companies you're researching and see when their financial or market profile changes."
          action={
            <button
              type="button"
              onClick={focusAddInput}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search Companies
            </button>
          }
        />
      ) : (
        <>
          <Card title="What's Changed" eyebrow="Deterministic change detection, not AI">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCheckInsights}
                disabled={insightsLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {insightsLoading ? 'Checking…' : 'Check What’s Changed'}
              </button>
              {insights && (
                <span className="text-xs text-ink-muted">
                  Compared against what you last saw - checking again updates that baseline.
                </span>
              )}
            </div>

            {insightsError && <p className="mt-3 text-sm text-critical">{insightsError}</p>}

            {insights && (
              <div className="mt-4 space-y-3">
                {insights.every((entry) => entry.changes.length === 0 && entry.status === 'compared') && (
                  <p className="text-sm text-ink-muted">No meaningful changes since you last checked.</p>
                )}
                {insights.map((entry) => (
                  <div key={entry.ticker}>
                    {entry.status === 'baseline_established' ? (
                      <p className="text-sm text-ink-muted">
                        <span className="font-semibold text-ink">{entry.ticker}</span> - now tracking; changes will
                        show up starting next time you check.
                      </p>
                    ) : (
                      entry.changes.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-ink">{entry.ticker}</p>
                          <ul className="mt-1 space-y-1">
                            {entry.changes.map((change) => (
                              <li key={change.metric} className="text-sm text-ink-secondary">
                                {change.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padded={false}>
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Search className="h-4 w-4 text-ink-muted" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter your watchlist…"
              aria-label="Filter watchlist"
              className="w-full max-w-xs bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  <th className="px-5 py-3">Company</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Daily Change</th>
                  <th className="px-3 py-3">Financial Health</th>
                  <th className="px-3 py-3">1Y Return</th>
                  <th className="px-3 py-3">P/E</th>
                  <th className="px-3 py-3">DCF Value</th>
                  <th className="px-3 py-3">Valuation Gap</th>
                  <th className="px-3 py-3">Latest Event</th>
                  <th className="px-3 py-3">Alerts</th>
                  <th className="px-3 py-3">Last Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCompanies.map((row) => {
                  const healthTier = getScoreTier(row.financialHealthScore)
                  const changeTier = getSentimentTier(
                    typeof row.price?.dailyChangePercent === 'number' ? row.price.dailyChangePercent >= 0 : null
                  )
                  const returnTier = getSentimentTier(
                    typeof row.oneYearReturnPercent === 'number' ? row.oneYearReturnPercent >= 0 : null
                  )
                  const gapTier = getSentimentTier(
                    row.dcf?.available && typeof row.dcf.valuationGapPercent === 'number'
                      ? row.dcf.valuationGapPercent >= 0
                      : null
                  )

                  return (
                    <tr key={row.ticker} className="transition-colors hover:bg-surface-sunken/50">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/financials/${encodeURIComponent(row.ticker)}/overview`)}
                          className="flex flex-col items-start text-left hover:underline"
                        >
                          <span className="font-semibold text-ink">{row.ticker}</span>
                          <span className="text-xs text-ink-muted">{row.name || 'Data unavailable'}</span>
                        </button>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink">{formatPerShare(row.price?.current)}</td>
                      <td className="px-3 py-3 tabular-nums" style={{ color: changeTier.hex }}>
                        {formatPercent(row.price?.dailyChangePercent)}
                      </td>
                      <td className="px-3 py-3">
                        {typeof row.financialHealthScore === 'number' ? (
                          <Badge tone={healthTier.className}>{row.financialHealthScore} · {healthTier.label}</Badge>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums" style={{ color: returnTier.hex }}>
                        {formatPercent(row.oneYearReturnPercent)}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink">
                        {typeof row.peRatio === 'number' ? row.peRatio.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink" title={!row.dcf?.available ? row.dcf?.reason : 'Illustrative assumptions - see Company Dashboard for a full DCF.'}>
                        {row.dcf?.available ? formatPerShare(row.dcf.intrinsicValuePerShare) : '—'}
                      </td>
                      <td className="px-3 py-3 tabular-nums" style={{ color: gapTier.hex }}>
                        {row.dcf?.available ? formatPercent(row.dcf.valuationGapPercent) : '—'}
                      </td>
                      <td className="w-[220px] max-w-[220px] px-3 py-3">
                        {row.latestEvent ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/financials/${encodeURIComponent(row.ticker)}/news`)}
                            className="block w-full text-left hover:underline"
                            title={row.latestEvent.title}
                          >
                            <span className="block truncate text-xs text-ink">{row.latestEvent.title}</span>
                            <span className="text-xs text-ink-muted">
                              {row.latestEvent.category} · {formatRelativeTime(row.latestEvent.publishedAt)}
                            </span>
                          </button>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {alertCounts[row.ticker] > 0 ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/alerts?ticker=${encodeURIComponent(row.ticker)}`)}
                            className="inline-flex items-center gap-1 rounded-full border border-brand-500/40 bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-500/20"
                            title={`View ${row.ticker} alerts`}
                          >
                            <Bell className="h-3 w-3" aria-hidden="true" />
                            {alertCounts[row.ticker]} alert{alertCounts[row.ticker] === 1 ? '' : 's'}
                          </button>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-muted">
                        <div>{formatDateTime(row.price?.asOf)}</div>
                        {row.financialStatementPeriod && <div>FY{row.financialStatementPeriod} statements</div>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/financials/${encodeURIComponent(row.ticker)}/overview`)}
                            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
                            aria-label={`Open ${row.ticker} dashboard`}
                            title="Open Company Dashboard"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(row.ticker)}
                            disabled={removingTicker === row.ticker}
                            className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Remove ${row.ticker} from watchlist`}
                            title="Remove from watchlist"
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
            {filteredCompanies.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-ink-muted">No companies match &quot;{search}&quot;.</p>
            )}
          </div>
          </Card>
        </>
      )}

      <p className="text-xs text-ink-muted">
        Market data updates continuously; Financial Health and DCF Value reflect the most recent statements and an
        illustrative DCF, not real-time prices. Not investment advice.
      </p>
    </div>
  )
}

export default Watchlist
