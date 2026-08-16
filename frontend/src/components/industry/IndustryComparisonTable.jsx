import { formatMetricValue, formatComparisonDelta } from '../../lib/industryFormat';

/**
 * "Company vs Industry" comparison table - Metric | Company | Industry
 * Median | Difference, per Sprint 13's COMPANY VS INDUSTRY spec. Units are
 * always labeled per-row (%, pp, or x) rather than mixed silently.
 */
function IndustryComparisonTable({ entries }) {
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-ink-muted">Not available for this reference universe.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <th className="px-3 py-2">Metric</th>
            <th className="px-3 py-2 text-right">Company</th>
            <th className="px-3 py-2 text-right">Industry Median</th>
            <th className="px-3 py-2 text-right">Difference</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.metric} className="border-b border-border last:border-0" title={!entry.available ? entry.note : undefined}>
              <td className="px-3 py-2.5 text-ink">{entry.label}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                {formatMetricValue(entry.company, entry.unit)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                {formatMetricValue(entry.industryMedian, entry.unit)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                {formatComparisonDelta(entry)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default IndustryComparisonTable;
