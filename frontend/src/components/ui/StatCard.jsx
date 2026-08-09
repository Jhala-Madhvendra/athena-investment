/**
 * A labeled stat tile - growth metrics, trend summary items, ratio cards.
 * `hex` colors the value itself (accepted for stat-tile deltas, unlike
 * in-chart labels which must stay neutral ink). `small` shrinks the value
 * type for cases where it's a phrase (e.g. "Turned profitable") rather
 * than a short percentage - a 24px number and a 24px sentence don't fit
 * the same slot.
 */
function StatCard({ label, value, hex, sublabel, trendIcon: TrendIcon, unit, small = false }) {
  return (
    <div className="rounded-lg border border-border bg-surface-sunken p-4 transition-colors hover:border-border-strong">
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`leading-tight font-bold tabular-nums ${small ? 'text-base' : 'text-2xl'}`}
          style={hex ? { color: hex } : { color: 'var(--color-ink)' }}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-ink-muted">{unit}</span>}
        {TrendIcon && <TrendIcon className="h-4 w-4 shrink-0" style={hex ? { color: hex } : undefined} aria-hidden="true" />}
      </div>
      {sublabel && <p className="mt-1 text-xs text-ink-muted">{sublabel}</p>}
    </div>
  );
}

export default StatCard;
