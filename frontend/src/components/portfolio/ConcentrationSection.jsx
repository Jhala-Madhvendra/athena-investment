import Card from '../ui/Card'
import StatCard from '../ui/StatCard'
import { formatPercent } from '../../lib/compsFormat'
import { formatHHI } from '../../lib/portfolioAnalyticsFormat'

/**
 * Extends Sprint 9's top1/top3 concentration (ConcentrationRisk.md) with
 * top5 and HHI. Same product principle as everywhere else in this
 * sprint: a concentration number is a fact, not a verdict - "concentrated"
 * is never rendered with warning color or "too much" language.
 */
function ConcentrationSection({ concentration }) {
  if (!concentration) return null

  const { top1WeightPercent, top3WeightPercent, top5WeightPercent, hhi } = concentration

  return (
    <Card title="Concentration" eyebrow="How much of the portfolio sits in its largest positions">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Top Holding" value={formatPercent(top1WeightPercent)} />
        <StatCard label="Top 3 Holdings" value={formatPercent(top3WeightPercent)} />
        <StatCard label="Top 5 Holdings" value={formatPercent(top5WeightPercent)} />
        <StatCard label="HHI" value={formatHHI(hhi)} sublabel="0 (diversified) - 10,000 (single holding)" />
      </div>
    </Card>
  )
}

export default ConcentrationSection
