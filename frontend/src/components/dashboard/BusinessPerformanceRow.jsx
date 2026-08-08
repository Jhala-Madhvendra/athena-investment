import TrendIndicator from './TrendIndicator';

/**
 * One row of the Business Performance section: label, current value,
 * direction chip, and the matching pre-generated insight text (if the
 * analysis engine produced one for this metric - not every row has a match).
 */
function BusinessPerformanceRow({ label, value, direction, invert = false, insightText }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-baseline sm:gap-6">
      <span className="text-sm font-semibold text-slate-800 sm:w-40 sm:shrink-0">{label}</span>
      <div className="flex-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-base font-bold tabular-nums text-slate-900">{value}</span>
          <TrendIndicator direction={direction} invert={invert} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {insightText || 'No specific insight available for this metric yet.'}
        </p>
      </div>
    </div>
  );
}

export default BusinessPerformanceRow;
