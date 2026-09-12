import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import Card from '../ui/Card'
import Skeleton from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'
import SectionHeader from '../ui/SectionHeader'
import PerformanceSection from '../portfolio/PerformanceSection'
import RiskSection from '../portfolio/RiskSection'
import ExposureSection from '../portfolio/ExposureSection'
import ConcentrationSection from '../portfolio/ConcentrationSection'
import CorrelationMatrix from '../portfolio/CorrelationMatrix'
import AssumptionsPanel from '../portfolio/AssumptionsPanel'
import { fetchJson } from '../../lib/api'

const WINDOW_OPTIONS = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
]

/**
 * GET /api/simulation/portfolios/:id/analytics - the what-if equivalent of
 * PortfolioAnalyticsSection, sourced from a paper portfolio instead of real
 * Holdings. The response is deliberately structured identically to the
 * real analytics response, so every rendering sub-component below
 * (PerformanceSection/RiskSection/ExposureSection/ConcentrationSection/
 * CorrelationMatrix/AssumptionsPanel) is reused completely unmodified.
 */
function SimulationAnalyticsSection({ portfolioId, holdingsCount }) {
  const [window_, setWindow] = useState('1y')
  const [benchmarkInput, setBenchmarkInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      if (holdingsCount === 0) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ window: window_ })
        if (benchmarkInput.trim()) params.set('benchmark', benchmarkInput.trim())
        const data = await fetchJson(
          `/api/simulation/portfolios/${portfolioId}/analytics?${params.toString()}`,
          undefined,
          controller.signal
        )
        setAnalytics(data)
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [portfolioId, holdingsCount, window_, benchmarkInput])

  const windowSelector = (
    <div className="flex items-center gap-2">
      <div className="flex overflow-hidden rounded-lg border border-border">
        {WINDOW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setWindow(option.value)}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              window_ === option.value ? 'bg-brand-500 text-white' : 'bg-surface-raised text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={benchmarkInput}
        onChange={(event) => setBenchmarkInput(event.target.value)}
        placeholder="Benchmark (SPY)"
        className="w-32 rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
      />
    </div>
  )

  if (holdingsCount === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Simulated Analytics" description="Performance, risk, exposure, and diversification for this what-if portfolio." />
        <EmptyState icon={BarChart3} title="No analytics yet" message="Add holdings to analyze this what-if portfolio's risk and diversification." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Simulated Analytics"
        description="Performance, risk, exposure, and diversification for this what-if portfolio."
        action={windowSelector}
      />

      {loading && (
        <div className="space-y-4">
          <Skeleton variant="card" count={1} />
          <Skeleton variant="card" count={1} />
        </div>
      )}

      {!loading && error && <ErrorState title="Couldn't load simulated analytics" message={error} />}

      {!loading && !error && analytics?.isEmpty && (
        <Card>
          <p className="text-sm text-ink-muted">{analytics.message}</p>
        </Card>
      )}

      {!loading && !error && analytics && !analytics.isEmpty && (
        <>
          <PerformanceSection performance={analytics.performance} windowLabel={analytics.window} />
          <RiskSection risk={analytics.risk} />
          <ExposureSection sectorExposure={analytics.sectorExposure} industryExposure={analytics.industryExposure} />
          <ConcentrationSection concentration={analytics.concentration} />
          <CorrelationMatrix correlation={analytics.correlation} />
          <AssumptionsPanel assumptions={analytics.assumptions} />
        </>
      )}
    </div>
  )
}

export default SimulationAnalyticsSection
