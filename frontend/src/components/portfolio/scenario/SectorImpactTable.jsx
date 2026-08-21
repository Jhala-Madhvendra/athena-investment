import Card from '../../ui/Card'
import { formatMoney, formatPercent } from '../../../lib/compsFormat'
import { getSentimentTier } from '../../../lib/scoreTokens'

/** Sector-level rollup of HoldingImpactTable's rows - see portfolio.scenario.calculator.js's attributeSectorImpact. */
function SectorImpactTable({ sectorImpact }) {
  if (!sectorImpact || sectorImpact.length === 0) return null

  return (
    <Card title="Impact by Sector" eyebrow="Aggregated from holding-level impact" padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
              <th className="px-5 py-3">Sector</th>
              <th className="px-3 py-3">Current Exposure</th>
              <th className="px-3 py-3">Scenario Value</th>
              <th className="px-3 py-3">Absolute Impact</th>
              <th className="px-3 py-3">Portfolio Impact</th>
              <th className="px-5 py-3">Contribution to Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sectorImpact.map((sector) => {
              const tier = getSentimentTier(typeof sector.absoluteChangeUSD === 'number' ? sector.absoluteChangeUSD >= 0 : null)
              return (
                <tr key={sector.sector} className="transition-colors hover:bg-surface-sunken/50">
                  <td className="px-5 py-3 font-semibold text-ink">{sector.sector}</td>
                  <td className="px-3 py-3 tabular-nums text-ink">{formatMoney(sector.currentValueUSD)}</td>
                  <td className="px-3 py-3 tabular-nums text-ink">{formatMoney(sector.scenarioValueUSD)}</td>
                  <td className="px-3 py-3 tabular-nums" style={{ color: tier.hex }}>
                    {formatMoney(sector.absoluteChangeUSD)}
                  </td>
                  <td className="px-3 py-3 tabular-nums" style={{ color: tier.hex }}>
                    {formatPercent(sector.portfolioImpactPercentagePoints)} pp
                  </td>
                  <td className="px-5 py-3 tabular-nums text-ink">
                    {typeof sector.contributionToScenarioImpactPercent === 'number'
                      ? formatPercent(sector.contributionToScenarioImpactPercent)
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default SectorImpactTable
