import Card from '../ui/Card'

/**
 * Every number in the Analytics sections above this panel depends on the
 * choices listed here (window, benchmark, risk-free rate, and - most
 * importantly - whether historical metrics were reconstructed from actual
 * recorded transactions or estimated by applying today's weights backward).
 * Sprint 14's product principle, extended by Sprint 15: assumptions must be
 * visible, not buried in a tooltip - and which methodology actually ran
 * must be as visible as the numbers themselves. See
 * PortfolioCalculationAssumptions.md.
 */
function AssumptionsPanel({ assumptions }) {
  if (!assumptions) return null

  const { analysisPeriod, benchmark, riskFreeRate, historicalWeightMethodology, historicalMethodology } = assumptions
  const isTransactionAware = historicalMethodology?.type === 'transaction_aware'

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
          <dt className="text-xs font-medium text-ink-muted">Historical Basis</dt>
          <dd className="mt-0.5 text-sm text-ink">
            <span
              className={
                isTransactionAware
                  ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
                  : 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800'
              }
            >
              {isTransactionAware ? 'Reconstructed from your transactions' : 'Current-weight approximation'}
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-ink-muted">{historicalWeightMethodology}</p>
      {isTransactionAware && (
        <p className="mt-1 text-xs text-ink-muted">
          Reconstructed since {historicalMethodology.analyticsStartDate}
          {historicalMethodology.windowClipped ? ' (earlier than the full requested window - your ledger doesn’t reach back further)' : ''}.
          {' '}
          {historicalMethodology.excludedTransactionDays > 0 &&
            `${historicalMethodology.excludedTransactionDays} day(s) around a buy/sell were excluded rather than estimated. `}
          {historicalMethodology.excludedMissingPriceDays > 0 &&
            `${historicalMethodology.excludedMissingPriceDays} day(s) were excluded for missing price data.`}
        </p>
      )}
      {!isTransactionAware && historicalMethodology?.transactionHistoryAvailable && (
        <p className="mt-1 text-xs text-ink-muted">{historicalMethodology.reason}</p>
      )}
    </Card>
  )
}

export default AssumptionsPanel
