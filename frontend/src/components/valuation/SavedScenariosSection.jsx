import { useEffect, useState } from 'react'
import { Save, Trash2, GitCompare, History } from 'lucide-react'
import Card from '../ui/Card'
import Skeleton from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'
import { fetchJson } from '../../lib/api'
import { formatPercent, formatPerShare } from '../../lib/compsFormat'

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

/**
 * Save named DCF assumption sets for this ticker, compare them side by
 * side, and backtest a saved set against current price/implied value. The
 * one identity-gated surface on an otherwise-public Valuation page - every
 * number here is labeled and descriptive, never a verdict on whether past
 * reasoning was "right" or "wrong" (see research/product/ProductBoundaries.md).
 */
function SavedScenariosSection({ ticker, assumptions }) {
  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [saveFormOpen, setSaveFormOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [compareResult, setCompareResult] = useState(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState('')

  const [backtestById, setBacktestById] = useState({})
  const [deletingId, setDeletingId] = useState(null)

  const loadScenarios = async (signal) => {
    setLoading(true)
    setListError('')
    try {
      const data = await fetchJson(`/api/valuation/${encodeURIComponent(ticker)}/dcf/saved`, undefined, signal)
      setScenarios(data.scenarios || [])
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setListError(requestError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadScenarios(controller.signal)
    setSelectedIds(new Set())
    setCompareResult(null)
    setBacktestById({})
    return () => controller.abort()
  }, [ticker])

  const handleSave = async (event) => {
    event.preventDefault()
    const name = saveName.trim()
    if (!name) {
      setSaveError('Enter a name for this scenario.')
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      await fetchJson(`/api/valuation/${encodeURIComponent(ticker)}/dcf/saved`, {
        method: 'POST',
        body: JSON.stringify({ name, ...assumptions }),
      })
      setSaveName('')
      setSaveFormOpen(false)
      await loadScenarios()
    } catch (requestError) {
      setSaveError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await fetchJson(`/api/valuation/${encodeURIComponent(ticker)}/dcf/saved/${id}`, { method: 'DELETE' })
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      await loadScenarios()
    } catch (requestError) {
      setListError(requestError.message)
    } finally {
      setDeletingId(null)
    }
  }

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setCompareResult(null)
  }

  const handleCompare = async () => {
    setComparing(true)
    setCompareError('')
    try {
      const data = await fetchJson(`/api/valuation/${encodeURIComponent(ticker)}/dcf/saved/compare`, {
        method: 'POST',
        body: JSON.stringify({ savedIds: [...selectedIds] }),
      })
      setCompareResult(data)
    } catch (requestError) {
      setCompareError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setComparing(false)
    }
  }

  const toggleBacktest = async (id) => {
    setBacktestById((prev) => {
      const existing = prev[id]
      if (existing?.open) {
        return { ...prev, [id]: { ...existing, open: false } }
      }
      return { ...prev, [id]: { ...existing, open: true } }
    })

    if (backtestById[id]?.data || backtestById[id]?.loading) return

    setBacktestById((prev) => ({ ...prev, [id]: { ...prev[id], open: true, loading: true, error: '' } }))
    try {
      const data = await fetchJson(`/api/valuation/${encodeURIComponent(ticker)}/dcf/saved/${id}/backtest`)
      setBacktestById((prev) => ({ ...prev, [id]: { open: true, loading: false, data, error: '' } }))
    } catch (requestError) {
      setBacktestById((prev) => ({ ...prev, [id]: { open: true, loading: false, data: null, error: requestError.message } }))
    }
  }

  const saveButton = (
    <button
      type="button"
      onClick={() => setSaveFormOpen((open) => !open)}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
    >
      <Save className="h-4 w-4" aria-hidden="true" />
      Save Current Assumptions
    </button>
  )

  return (
    <Card title="Saved Scenarios" eyebrow="Compare your own assumptions over time" action={saveButton}>
      <div className="space-y-4">
        {saveFormOpen && (
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-sunken/50 p-3">
            <div className="flex-1">
              <label htmlFor="saved-scenario-name" className="mb-1 block text-xs font-medium text-ink-muted">
                Scenario name
              </label>
              <input
                id="saved-scenario-name"
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Aggressive AI growth"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}
        {saveError && <p className="text-sm text-critical">{saveError}</p>}

        {loading && <Skeleton variant="table" count={2} />}
        {!loading && listError && <ErrorState title="Couldn't load saved scenarios" message={listError} />}

        {!loading && !listError && scenarios.length === 0 && (
          <EmptyState
            icon={History}
            compact
            title="No saved scenarios yet"
            message="Save your current DCF assumptions to compare them, or check back later to see how price has moved."
          />
        )}

        {!loading && !listError && scenarios.length > 0 && (
          <div className="space-y-2">
            {scenarios.map((scenario) => {
              const backtest = backtestById[scenario._id]
              return (
                <div key={scenario._id} className="rounded-lg border border-border bg-surface-sunken/40 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(scenario._id)}
                      onChange={() => toggleSelected(scenario._id)}
                      aria-label={`Select ${scenario.name} for comparison`}
                      className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500/30"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{scenario.name}</p>
                      <p className="text-xs text-ink-muted">Saved {formatDateTime(scenario.createdAt)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-ink-muted">Implied value at save</p>
                      <p className="tabular-nums font-semibold text-ink">{formatPerShare(scenario.impliedValuePerShareAtSave)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-ink-muted">Price at save</p>
                      <p className="tabular-nums font-semibold text-ink">{formatPerShare(scenario.priceAtSave)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBacktest(scenario._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken"
                    >
                      <History className="h-3.5 w-3.5" aria-hidden="true" />
                      {backtest?.open ? 'Hide Backtest' : 'Backtest'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(scenario._id)}
                      disabled={deletingId === scenario._id}
                      aria-label={`Delete ${scenario.name}`}
                      className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  {backtest?.open && (
                    <div className="mt-3 border-t border-border pt-3">
                      {backtest.loading && <p className="text-xs text-ink-muted">Loading backtest…</p>}
                      {backtest.error && <p className="text-xs text-critical">{backtest.error}</p>}
                      {backtest.data && (
                        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-xs text-ink-muted">Price then → now</p>
                            <p className="tabular-nums text-ink">
                              {formatPerShare(backtest.data.priceAtSave)} → {formatPerShare(backtest.data.currentPrice)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-ink-muted">Price change since save</p>
                            <p className="tabular-nums text-ink">{formatPercent(backtest.data.priceChangeSinceSavePercent)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-ink-muted">Implied value then → now</p>
                            <p className="tabular-nums text-ink">
                              {formatPerShare(backtest.data.impliedValuePerShareAtSave)} → {formatPerShare(backtest.data.impliedValuePerShareNow)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-ink-muted">Upside/downside now</p>
                            <p className="tabular-nums text-ink">{formatPercent(backtest.data.upsideDownsidePercentNow)}</p>
                          </div>
                          <p className="col-span-full text-xs text-ink-muted">{backtest.data.disclaimer}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {scenarios.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <span className="text-xs text-ink-muted">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={handleCompare}
              disabled={selectedIds.size < 2 || comparing}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
              {comparing ? 'Comparing…' : 'Compare Selected'}
            </button>
          </div>
        )}

        {compareError && <p className="text-sm text-critical">{compareError}</p>}

        {compareResult && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Implied Value</th>
                  <th className="px-3 py-2">Market Price</th>
                  <th className="px-3 py-2">Upside/Downside</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {compareResult.comparisonTable.map((row) => (
                  <tr key={`${row.source}-${row.id ?? row.name}`}>
                    <td className="px-3 py-2 font-semibold text-ink">{row.name}</td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      {row.isValid ? formatPerShare(row.intrinsicValuePerShare) : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      {row.isValid ? formatPerShare(row.currentMarketPrice) : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      {row.isValid ? formatPercent(row.upsideDownsidePercent) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compareResult.unavailable?.length > 0 && (
              <p className="border-t border-border px-3 py-2 text-xs text-ink-muted">
                {compareResult.unavailable.length} selected scenario(s) could not be included - they may have been deleted.
              </p>
            )}
            <p className="border-t border-border px-3 py-2 text-xs text-ink-muted">{compareResult.disclaimer}</p>
          </div>
        )}
      </div>
    </Card>
  )
}

export default SavedScenariosSection
