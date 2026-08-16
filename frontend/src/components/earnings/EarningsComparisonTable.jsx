import { Fragment } from 'react'
import SignalBadge from './SignalBadge'
import { formatMetricValue, formatMetricChange } from '../../lib/earningsFormat'

/**
 * The Sprint 12 brief's "Earnings Comparison Table": Metric | Latest Period
 * | Previous Period | Change | Signal, grouped by category (Growth,
 * Profitability, Cash Flow, Balance Sheet, Per Share). Margin metrics show
 * a percentage-POINT change, never a relative percent - see
 * formatMetricChange in lib/earningsFormat.js and the brief's own
 * "-2 percentage points, not -2%" example.
 *
 * @param {{groups: Array<{title: string, rows: Array<{key: string, label: string, type: string, metric: object, signal: string|null}>}>, latestLabel: string, previousLabel: string}} props
 */
function EarningsComparisonTable({ groups, latestLabel, previousLabel }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <th className="py-2 pr-4">Metric</th>
            <th className="py-2 pr-4">{latestLabel || 'Latest Period'}</th>
            <th className="py-2 pr-4">{previousLabel || 'Previous Period'}</th>
            <th className="py-2 pr-4">Change</th>
            <th className="py-2 pr-4">Signal</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.title}>
              <tr>
                <td colSpan={5} className="pt-4 pb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  {group.title}
                </td>
              </tr>
              {group.rows.map((row) => {
                const change = formatMetricChange(row.metric, row.type)
                return (
                  <tr key={row.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium text-ink">{row.label}</td>
                    <td className="py-2 pr-4 tabular-nums text-ink">
                      {row.metric?.available ? formatMetricValue(row.metric.latest, row.type) : 'Not available'}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-ink-secondary">
                      {typeof row.metric?.previous === 'number' ? formatMetricValue(row.metric.previous, row.type) : 'Not available'}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-ink-secondary">{change || 'Not available'}</td>
                    <td className="py-2 pr-4">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default EarningsComparisonTable
