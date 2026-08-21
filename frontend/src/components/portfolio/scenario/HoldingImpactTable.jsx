import Card from '../../ui/Card'
import { formatMoney } from '../../../lib/compsFormat'
import { formatPercent } from '../../../lib/compsFormat'
import { getSentimentTier } from '../../../lib/scoreTokens'

const ruleDescription = (rule) => {
  if (!rule) return 'Unaffected'
  if (rule.targetType === 'MARKET') return 'Market (beta-based)'
  if (rule.targetType === 'PORTFOLIO') return 'Entire Portfolio'
  return `${rule.targetType.charAt(0)}${rule.targetType.slice(1).toLowerCase()}: ${rule.target}`
}

/**
 * "Which holdings caused most of the scenario loss" (sprint brief) - sorted
 * by |absoluteChangeUSD| so the biggest dollar movers surface first,
 * regardless of whether they're gains or losses. portfolioImpactPercentagePoints
 * and contributionToScenarioImpactPercent are shown as two separate columns
 * deliberately - see portfolio.scenario.calculator.js's header comment on
 * why contribution and portfolio weight are not the same number.
 */
function HoldingImpactTable({ holdingImpact }) {
  if (!holdingImpact || holdingImpact.length === 0) return null

  const sorted = [...holdingImpact].sort((a, b) => Math.abs(b.absoluteChangeUSD || 0) - Math.abs(a.absoluteChangeUSD || 0))

  return (
    <Card title="Impact by Holding" eyebrow="USD-normalized, sorted by dollar impact" padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
              <th className="px-5 py-3">Holding</th>
              <th className="px-3 py-3">Applied Rule</th>
              <th className="px-3 py-3">Shock</th>
              <th className="px-3 py-3">Current Value</th>
              <th className="px-3 py-3">Scenario Value</th>
              <th className="px-3 py-3">Change</th>
              <th className="px-3 py-3">Portfolio Impact</th>
              <th className="px-5 py-3">Contribution to Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((holding) => {
              const tier = getSentimentTier(
                typeof holding.absoluteChangeUSD === 'number' ? holding.absoluteChangeUSD >= 0 : null
              )
              return (
                <tr key={holding.ticker} className="transition-colors hover:bg-surface-sunken/50">
                  <td className="px-5 py-3 font-semibold text-ink">{holding.ticker}</td>
                  <td className="px-3 py-3 text-ink-secondary">{ruleDescription(holding.appliedRule)}</td>
                  <td className="px-3 py-3 tabular-nums" style={{ color: holding.unaffected ? undefined : tier.hex }}>
                    {holding.unaffected ? '—' : formatPercent(holding.effectiveShockPercent)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-ink">{formatMoney(holding.currentValueUSD)}</td>
                  <td className="px-3 py-3 tabular-nums text-ink">{formatMoney(holding.scenarioValueUSD)}</td>
                  <td className="px-3 py-3 tabular-nums" style={{ color: tier.hex }}>
                    {formatMoney(holding.absoluteChangeUSD)}
                  </td>
                  <td className="px-3 py-3 tabular-nums" style={{ color: tier.hex }}>
                    {formatPercent(holding.portfolioImpactPercentagePoints)} pp
                  </td>
                  <td className="px-5 py-3 tabular-nums text-ink">
                    {typeof holding.contributionToScenarioImpactPercent === 'number'
                      ? formatPercent(holding.contributionToScenarioImpactPercent)
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-ink-muted">
        Contribution to Impact is this holding's share of the scenario's total dollar change - not its portfolio weight. A
        small holding with a large shock can contribute far more than its weight suggests.
      </p>
    </Card>
  )
}

export default HoldingImpactTable
