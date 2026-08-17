import Card from '../ui/Card'
import { formatPercent } from '../../lib/compsFormat'

/**
 * Deliberately minimal (one bar per group, no chart library) - same
 * choice PositioningBars.jsx made for Sprint 13, per the product
 * guidance against an over-visualized dashboard. Sector/industry
 * classification is reused directly from Company.sector/Company.industry
 * (Sprint 13's fields) - no new taxonomy.
 */
function ExposureGroup({ title, groups }) {
  if (!groups || groups.length === 0) {
    return (
      <div>
        <h4 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h4>
        <p className="text-sm text-ink-muted">No classified holdings to group.</p>
      </div>
    )
  }

  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h4>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-secondary">{group.label}</span>
              <span className="tabular-nums font-medium text-ink">{formatPercent(group.weightPercent)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.min(100, Math.max(0, group.weightPercent))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExposureSection({ sectorExposure, industryExposure }) {
  return (
    <Card title="Exposure" eyebrow="Sector and industry weight, not a diversification score">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ExposureGroup title="Sector" groups={sectorExposure} />
        <ExposureGroup title="Industry" groups={industryExposure} />
      </div>
    </Card>
  )
}

export default ExposureSection
