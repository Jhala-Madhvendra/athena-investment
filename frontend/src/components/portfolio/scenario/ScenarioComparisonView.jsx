import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { X } from 'lucide-react'
import Card from '../../ui/Card'
import ChartTooltip from '../../charts/ChartTooltip'
import { formatMoney, formatPercent } from '../../../lib/compsFormat'
import { getSentimentTier } from '../../../lib/scoreTokens'

/**
 * Side-by-side comparison of already-run scenarios (sprint brief's
 * "Scenario Comparison" table/chart). Deliberately reports only the
 * "largest modeled impact," never a "best"/"most dangerous" ranking or
 * investment verdict - Athena describes modeled consequences, it doesn't
 * advise. See research/product/AdvancedScenarioProductDesign.md.
 */
function ScenarioComparisonView({ comparisonList, onRemove, onClear }) {
  if (!comparisonList || comparisonList.length === 0) return null

  const chartData = comparisonList.map((item) => ({
    name: item.name,
    percentageChange: item.percentageChange ?? 0,
  }))

  return (
    <Card
      title="Scenario Comparison"
      eyebrow="How sensitive is this portfolio across scenarios"
      action={
        <button type="button" onClick={onClear} className="text-xs font-semibold text-ink-muted hover:text-critical">
          Clear all
        </button>
      }
    >
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={Math.max(120, comparisonList.length * 48)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#e1e0d9" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fill: '#898781', fontSize: 12 }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#3d3b34', fontSize: 12 }} axisLine={false} tickLine={false} />
            <ReferenceLine x={0} stroke="#c3c2b7" />
            <Tooltip content={<ChartTooltip formatter={(v) => formatPercent(v)} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="percentageChange" name="Portfolio Impact" radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={getSentimentTier(entry.percentageChange >= 0).hex} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
              <th className="py-2">Scenario</th>
              <th className="py-2">Scenario Portfolio Value</th>
              <th className="py-2">Absolute Change</th>
              <th className="py-2">Percentage Change</th>
              <th className="py-2 text-right">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {comparisonList.map((item) => {
              const tier = getSentimentTier(typeof item.absoluteChangeUSD === 'number' ? item.absoluteChangeUSD >= 0 : null)
              return (
                <tr key={item.name}>
                  <td className="py-2 font-semibold text-ink">{item.name}</td>
                  <td className="py-2 tabular-nums text-ink">{formatMoney(item.scenarioPortfolioValueUSD)}</td>
                  <td className="py-2 tabular-nums" style={{ color: tier.hex }}>
                    {formatMoney(item.absoluteChangeUSD)}
                  </td>
                  <td className="py-2 tabular-nums" style={{ color: tier.hex }}>
                    {formatPercent(item.percentageChange)}
                  </td>
                  <td className="py-2 text-right">
                    {onRemove && (
                      <button type="button" onClick={() => onRemove(item.name)} aria-label={`Remove ${item.name} from comparison`} className="text-ink-muted hover:text-critical">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Comparison reflects the largest modeled impact under each scenario's hypothetical assumptions - not a
        recommendation or a prediction of which scenario is more likely.
      </p>
    </Card>
  )
}

export default ScenarioComparisonView
