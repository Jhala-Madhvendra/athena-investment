import Card from '../ui/Card'
import StatCard from '../ui/StatCard'
import { formatPercent } from '../../lib/compsFormat'
import { formatRatio, formatDate } from '../../lib/portfolioAnalyticsFormat'

/**
 * Every stat here is a neutral description of the portfolio's historical
 * behavior, never a verdict - no "too risky" language, no color-coding a
 * high beta or a deep drawdown as "bad" (unlike gain/loss, which
 * legitimately has a sentiment). See ConcentrationRisk.md's product
 * principle, applied the same way to every risk metric.
 */
function RiskSection({ risk }) {
  if (!risk) return null

  const { volatilityPercent, beta, betaCoveragePercent, sharpeRatio, maxDrawdown } = risk

  return (
    <Card title="Risk" eyebrow="Portfolio characteristics, not a risk verdict">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Volatility (Annualized)" value={formatPercent(volatilityPercent)} sublabel="Std. dev. of daily returns" />
        <StatCard
          label="Beta"
          value={formatRatio(beta)}
          sublabel={typeof betaCoveragePercent === 'number' ? `${betaCoveragePercent.toFixed(0)}% of value covered` : undefined}
        />
        <StatCard label="Sharpe Ratio" value={formatRatio(sharpeRatio)} sublabel="Risk-adjusted return" />
        <StatCard
          label="Max Drawdown"
          value={typeof maxDrawdown?.maxDrawdownPercent === 'number' ? `${maxDrawdown.maxDrawdownPercent.toFixed(1)}%` : '—'}
          sublabel={maxDrawdown?.troughDate ? `Trough: ${formatDate(maxDrawdown.troughDate)}` : 'No drawdown observed'}
        />
      </div>
      {maxDrawdown?.peakDate && (
        <p className="mt-4 text-xs text-ink-muted">
          Peak: {formatDate(maxDrawdown.peakDate)} · Trough: {formatDate(maxDrawdown.troughDate)} ·{' '}
          {maxDrawdown.recoveryDate ? `Recovered: ${formatDate(maxDrawdown.recoveryDate)}` : 'Not yet recovered within this window'}.
          Historical, not predictive of future losses.
        </p>
      )}
    </Card>
  )
}

export default RiskSection
