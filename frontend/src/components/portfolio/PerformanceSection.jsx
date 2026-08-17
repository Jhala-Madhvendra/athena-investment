import Card from '../ui/Card'
import StatCard from '../ui/StatCard'
import { formatPercent } from '../../lib/compsFormat'

/**
 * Two distinct return numbers, deliberately not merged into one - see
 * PortfolioReturn.md. `unrealizedReturnPercent` is Sprint 9's cost-basis
 * return (no time dimension). `periodReturnPercent`/`annualizedReturnPercent`
 * are the new historical-series estimate (current weights applied
 * backward), which is why this section sits right above the Assumptions
 * panel it depends on.
 */
function PerformanceSection({ performance, windowLabel }) {
  if (!performance) return null

  const { unrealizedReturnPercent, periodReturnPercent, annualizedReturnPercent, benchmark, observedTradingDays } = performance

  return (
    <Card title="Performance" eyebrow="Analytical observations, not advice">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Unrealized Return" value={formatPercent(unrealizedReturnPercent)} sublabel="Cost basis vs. current value" />
        <StatCard
          label={`${windowLabel} Return`}
          value={formatPercent(periodReturnPercent)}
          sublabel="Estimated, current weights"
        />
        <StatCard label="Annualized" value={formatPercent(annualizedReturnPercent)} sublabel="Same estimate, annualized" />
        <StatCard
          label={`Benchmark (${benchmark?.ticker ?? '—'})`}
          value={benchmark?.resolved ? formatPercent(benchmark.periodReturnPercent) : '—'}
          sublabel={`${windowLabel}, for context`}
        />
      </div>
      {observedTradingDays !== undefined && (
        <p className="mt-4 text-xs text-ink-muted">
          Based on {observedTradingDays} trading days with sufficient holding coverage in the selected window. Historical
          figures are estimated by applying today's holdings to past price returns - see Assumptions below.
        </p>
      )}
    </Card>
  )
}

export default PerformanceSection
