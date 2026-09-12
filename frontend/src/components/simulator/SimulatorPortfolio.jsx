import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import Card from '../ui/Card'
import Skeleton from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import SectionHeader from '../ui/SectionHeader'
import StatCard from '../ui/StatCard'
import TickerAutocomplete from '../ui/TickerAutocomplete'
import SimulationAnalyticsSection from './SimulationAnalyticsSection'
import SimulationScenarioSection from './SimulationScenarioSection'
import { fetchJson } from '../../lib/api'
import { formatPercent } from '../../lib/compsFormat'
import { getSentimentTier } from '../../lib/scoreTokens'

const formatCurrency = (value) => (typeof value === 'number' ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—')

const emptyDraftRow = { ticker: '', shares: '', assumedPrice: '' }

const draftFromHoldings = (holdings) =>
  (holdings || []).map((h) => ({
    ticker: h.ticker,
    shares: String(h.shares),
    assumedPrice: h.assumedPriceDefaulted ? '' : String(h.averagePurchasePrice ?? ''),
  }))

/**
 * A single what-if portfolio's detail page: an editable holdings array
 * (no per-holding CRUD route on the backend - PUT replaces the whole
 * holdings array at once, so this page is a draft editor with an explicit
 * Save, not row-level modals), plus the same analytics/scenario sections a
 * real portfolio gets, sourced from this hypothetical holdings set instead.
 */
function SimulatorPortfolio() {
  const { portfolioId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [liveHoldings, setLiveHoldings] = useState([])
  const [summary, setSummary] = useState(null)

  const [holdingsDraft, setHoldingsDraft] = useState([])
  const [lastSavedDraftJson, setLastSavedDraftJson] = useState('[]')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadPortfolio = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchJson(`/api/simulation/portfolios/${portfolioId}`, undefined, signal)
      setName(data.name)
      setLiveHoldings(data.holdings || [])
      setSummary(data.summary)
      const draft = draftFromHoldings(data.holdings)
      setHoldingsDraft(draft)
      setLastSavedDraftJson(JSON.stringify(draft))
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
  }, [portfolioId])

  const dirty = JSON.stringify(holdingsDraft) !== lastSavedDraftJson

  const updateRow = (index, field, value) => {
    setHoldingsDraft((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const removeRow = (index) => {
    setHoldingsDraft((prev) => prev.filter((_, i) => i !== index))
  }

  const addRow = () => {
    setHoldingsDraft((prev) => [...prev, { ...emptyDraftRow }])
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const holdings = holdingsDraft
        .filter((row) => row.ticker.trim())
        .map((row) => ({
          ticker: row.ticker.trim().toUpperCase(),
          shares: Number(row.shares),
          assumedPrice: row.assumedPrice === '' ? null : Number(row.assumedPrice),
        }))

      await fetchJson(`/api/simulation/portfolios/${portfolioId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, holdings }),
      })
      await loadPortfolio()
    } catch (requestError) {
      setSaveError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="What-If Portfolio" description="Loading…" />
        <Skeleton variant="card" count={1} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="What-If Portfolio" description="Loading failed." />
        <ErrorState title="Couldn't load this what-if portfolio" message={error} />
      </div>
    )
  }

  const returnTier = getSentimentTier(typeof summary?.totalReturnPercent === 'number' ? summary.totalReturnPercent >= 0 : null)

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/simulator')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All What-If Portfolios
      </button>

      <SectionHeader
        title="What-If Portfolio"
        description="A hypothetical portfolio, independent of what you actually own."
      />

      <div>
        <label htmlFor="portfolio-name" className="mb-1 block text-xs font-medium text-ink-muted">
          Portfolio name
        </label>
        <input
          id="portfolio-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
        />
      </div>

      {liveHoldings.length > 0 && summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Current Value" value={formatCurrency(summary.totalCurrentValue)} />
          <StatCard label="Assumed Cost Basis" value={formatCurrency(summary.totalCostBasis)} />
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

      <Card
        title="Holdings"
        eyebrow="Hypothetical shares - edit freely, nothing is saved until you click Save"
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                <th className="px-5 py-3">Ticker</th>
                <th className="px-3 py-3">Shares</th>
                <th className="px-3 py-3">Assumed Price</th>
                <th className="px-5 py-3 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {holdingsDraft.map((row, index) => (
                <tr key={index}>
                  <td className="px-5 py-2">
                    <TickerAutocomplete
                      value={row.ticker}
                      onChange={(value) => updateRow(index, 'ticker', value)}
                      placeholder="AAPL or company name"
                      ariaLabel={`Holding ${index + 1} ticker or company name`}
                      className="w-40 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.shares}
                      onChange={(e) => updateRow(index, 'shares', e.target.value)}
                      aria-label={`Holding ${index + 1} shares`}
                      className="w-24 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.assumedPrice}
                      onChange={(e) => updateRow(index, 'assumedPrice', e.target.value)}
                      placeholder="auto = live price"
                      aria-label={`Holding ${index + 1} assumed price`}
                      className="w-36 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                    />
                  </td>
                  <td className="px-5 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      aria-label={`Remove holding ${index + 1}`}
                      className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-sunken"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Holding
          </button>
          <div className="flex items-center gap-3">
            {saveError && <p className="text-sm text-critical">{saveError}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Saving…' : 'Save Holdings'}
            </button>
          </div>
        </div>
      </Card>

      <SimulationAnalyticsSection portfolioId={portfolioId} holdingsCount={liveHoldings.length} />
      <SimulationScenarioSection portfolioId={portfolioId} holdingsCount={liveHoldings.length} />

      <p className="text-xs text-ink-muted">
        This is a hypothetical what-if tool - Athena does not connect to a brokerage, execute trades, or recommend
        buying or selling anything. Not investment advice.
      </p>
    </div>
  )
}

export default SimulatorPortfolio
