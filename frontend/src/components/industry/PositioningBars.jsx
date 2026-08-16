import { ordinal } from '../../lib/industryFormat';

/**
 * Simple percentile indicators - one horizontal bar per metric, filled to
 * the company's percentile within the reference universe. Deliberately
 * minimal (no chart library) per Sprint 13's VISUALIZATION guidance: "Do
 * NOT create a dashboard overloaded with charts." Percentile alone is never
 * framed as good/bad (see COMPANY POSITION).
 */
function PositioningBars({ positioning }) {
  const available = (positioning || []).filter((entry) => entry.percentile !== null);

  if (available.length === 0) {
    return <p className="text-sm text-ink-muted">Not enough data in the reference universe to compute percentile positioning.</p>;
  }

  return (
    <div className="space-y-4">
      {available.map((entry) => (
        <div key={entry.metric}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-secondary">{entry.label}</span>
            <span className="tabular-nums font-medium text-ink">{ordinal(entry.percentile)} percentile</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.min(100, Math.max(0, entry.percentile))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default PositioningBars;
