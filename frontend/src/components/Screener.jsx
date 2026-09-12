import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownAZ, ArrowUpAZ, Search, SlidersHorizontal } from 'lucide-react'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import EmptyState from './ui/EmptyState'
import SectionHeader from './ui/SectionHeader'
import Badge from './ui/Badge'
import { fetchJson } from '../lib/api'
import { formatMoney } from '../lib/compsFormat'
import { getScoreTier } from '../lib/scoreTokens'

const emptyFilters = {
  sector: '',
  industry: '',
  minMarketCap: '',
  maxMarketCap: '',
  minHealthScore: '',
  maxHealthScore: '',
  sortBy: 'healthScore',
  sortDirection: 'desc',
}

const SORT_OPTIONS = [
  { value: 'healthScore', label: 'Health Score' },
  { value: 'marketCap', label: 'Market Cap' },
  { value: 'name', label: 'Name' },
]

const buildQuery = (filters) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value)
  })
  return params.toString()
}

/**
 * Filters/ranks companies already in Athena's database by Health Score and
 * financial ratios. GET /api/screener computes everything - this page only
 * builds the request and formats the response. Results are a sorted list,
 * never a ranking framed as advice (see research/product/ProductBoundaries.md) -
 * copy here stays "sorted by," never "top picks" or "recommended."
 */
function Screener() {
  const navigate = useNavigate()

  const [filters, setFilters] = useState(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [facets, setFacets] = useState({ sectors: [], industries: [] })

  /** Real sector/industry values already in Athena, not free text - sector/industry are matched with exact equality server-side, so a typo or casing mismatch would otherwise silently return zero results. */
  useEffect(() => {
    const controller = new AbortController()
    fetchJson('/api/screener/facets', undefined, controller.signal)
      .then((result) => setFacets({ sectors: result.sectors || [], industries: result.industries || [] }))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setFacets({ sectors: [], industries: [] })
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const query = buildQuery(appliedFilters)
        const result = await fetchJson(`/api/screener${query ? `?${query}` : ''}`, undefined, controller.signal)
        setData(result)
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [appliedFilters])

  const handleApply = (event) => {
    event.preventDefault()
    setAppliedFilters(filters)
  }

  const handleReset = () => {
    setFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
  }

  const toggleSortDirection = () => {
    setFilters((prev) => ({ ...prev, sortDirection: prev.sortDirection === 'desc' ? 'asc' : 'desc' }))
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none'

  const filterForm = (
    <form onSubmit={handleApply} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <div>
        <label htmlFor="screener-sector" className="mb-1 block text-xs font-medium text-ink-muted">Sector</label>
        <select
          id="screener-sector"
          value={filters.sector}
          onChange={(e) => setFilters((prev) => ({ ...prev, sector: e.target.value }))}
          className={inputClass}
        >
          <option value="">All sectors</option>
          {facets.sectors.map((sector) => (
            <option key={sector} value={sector}>{sector}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="screener-industry" className="mb-1 block text-xs font-medium text-ink-muted">Industry</label>
        <select
          id="screener-industry"
          value={filters.industry}
          onChange={(e) => setFilters((prev) => ({ ...prev, industry: e.target.value }))}
          className={inputClass}
        >
          <option value="">All industries</option>
          {facets.industries.map((industry) => (
            <option key={industry} value={industry}>{industry}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="screener-min-cap" className="mb-1 block text-xs font-medium text-ink-muted">Min Market Cap (USD)</label>
        <input
          id="screener-min-cap"
          type="number"
          min="0"
          value={filters.minMarketCap}
          onChange={(e) => setFilters((prev) => ({ ...prev, minMarketCap: e.target.value }))}
          placeholder="e.g. 50000000000"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="screener-max-cap" className="mb-1 block text-xs font-medium text-ink-muted">Max Market Cap (USD)</label>
        <input
          id="screener-max-cap"
          type="number"
          min="0"
          value={filters.maxMarketCap}
          onChange={(e) => setFilters((prev) => ({ ...prev, maxMarketCap: e.target.value }))}
          placeholder="e.g. 1500000000000"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="screener-min-score" className="mb-1 block text-xs font-medium text-ink-muted">Min Health Score</label>
        <input
          id="screener-min-score"
          type="number"
          min="0"
          max="100"
          value={filters.minHealthScore}
          onChange={(e) => setFilters((prev) => ({ ...prev, minHealthScore: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="screener-sort-by" className="mb-1 block text-xs font-medium text-ink-muted">Sort By</label>
        <div className="flex gap-1">
          <select
            id="screener-sort-by"
            value={filters.sortBy}
            onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
            className={inputClass}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleSortDirection}
            aria-label={`Sort ${filters.sortDirection === 'desc' ? 'descending' : 'ascending'}`}
            title={filters.sortDirection === 'desc' ? 'Descending' : 'Ascending'}
            className="shrink-0 rounded-lg border border-border bg-surface-raised px-2.5 text-ink-secondary hover:bg-surface-sunken"
          >
            {filters.sortDirection === 'desc' ? (
              <ArrowDownAZ className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowUpAZ className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Apply
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-sunken"
        >
          Reset
        </button>
      </div>
    </form>
  )

  const companies = data?.companies || []

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Screener"
        description="Filter and sort companies already in Athena by Health Score and financial ratios."
      />

      <Card title="Filters" eyebrow="Applies to companies already researched in Athena">
        {filterForm}
      </Card>

      {loading && <Skeleton variant="card" count={1} />}

      {!loading && error && <ErrorState title="Couldn't load the screener" message={error} />}

      {!loading && !error && companies.length === 0 && (
        <EmptyState
          icon={SlidersHorizontal}
          title="No companies match these filters"
          message="Try widening your filters, or research more companies elsewhere in Athena to grow the screenable universe."
        />
      )}

      {!loading && !error && companies.length > 0 && (
        <>
          {data.cappedNote && <p className="text-xs text-ink-muted">{data.cappedNote}</p>}

          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    <th className="px-5 py-3">Company</th>
                    <th className="px-3 py-3">Sector</th>
                    <th className="px-3 py-3">Industry</th>
                    <th className="px-3 py-3">Market Cap</th>
                    <th className="px-3 py-3">Health Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companies.map((company) => {
                    const tier = company.healthScore ? getScoreTier(company.healthScore.overall) : null
                    return (
                      <tr key={company.ticker} className="transition-colors hover:bg-surface-sunken/50">
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/financials/${encodeURIComponent(company.ticker)}/overview`)}
                            className="flex flex-col items-start text-left hover:underline"
                          >
                            <span className="font-semibold text-ink">{company.ticker}</span>
                            <span className="text-xs text-ink-muted">{company.name || 'Data unavailable'}</span>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-ink-secondary">{company.sector || '—'}</td>
                        <td className="px-3 py-3 text-ink-secondary">{company.industry || '—'}</td>
                        <td className="px-3 py-3 tabular-nums text-ink">{formatMoney(company.marketCap, company.currency)}</td>
                        <td className="px-3 py-3">
                          {company.dataAvailable && tier ? (
                            <Badge tone={tier.className}>
                              {company.healthScore.overall} · {tier.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-ink-muted" title={company.unavailableReason || undefined}>
                              Unavailable
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {data?.disclaimer && <p className="text-xs text-ink-muted">{data.disclaimer}</p>}
    </div>
  )
}

export default Screener
