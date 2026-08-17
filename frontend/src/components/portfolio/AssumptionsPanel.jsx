import Card from '../ui/Card'

/**
 * Every number in the Analytics sections above this panel depends on the
 * choices listed here (window, benchmark, risk-free rate, and - most
 * importantly - that historical weights are today's weights applied
 * backward, not a real historical record). Sprint 14's product principle:
 * assumptions must be visible, not buried in a tooltip. See
 * PortfolioCalculationAssumptions.md.
 */
function AssumptionsPanel({ assumptions }) {
  if (!assumptions) return null

  const { analysisPeriod, benchmark, riskFreeRate, historicalWeightMethodology } = assumptions

  return (
    <Card title="Assumptions" eyebrow="Read this before interpreting the numbers above">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-ink-muted">Analysis Period</dt>
          <dd className="mt-0.5 text-sm text-ink">{analysisPeriod?.label ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-muted">Benchmark</dt>
          <dd className="mt-0.5 text-sm text-ink">
            {benchmark?.ticker ?? '—'}
            <span className="ml-1 text-xs text-ink-muted">({benchmark?.source === 'auto' ? 'auto-selected' : 'your choice'})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-muted">Risk-Free Rate</dt>
          <dd className="mt-0.5 text-sm text-ink">
            {typeof riskFreeRate?.value === 'number' ? `${(riskFreeRate.value * 100).toFixed(2)}%` : '—'}
            <span className="ml-1 text-xs text-ink-muted">
              ({riskFreeRate?.source === 'market' ? 'live 10Y Treasury' : 'assumption'})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-muted">Historical Weights</dt>
          <dd className="mt-0.5 text-sm text-ink">Current-weight approximation</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-ink-muted">{historicalWeightMethodology}</p>
    </Card>
  )
}

export default AssumptionsPanel
