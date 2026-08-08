/**
 * A labeled stat tile - growth metrics, trend summary items, ratio cards.
 * `hex` colors the value itself (accepted for stat-tile deltas, unlike
 * in-chart labels which must stay neutral ink). `small` shrinks the value
 * type for cases where it's a phrase (e.g. "Turned profitable") rather
 * than a short percentage - a 24px number and a 24px sentence don't fit
 * the same slot.
 */
function StatCard({ label, value, hex, sublabel, trendEmoji, unit, small = false }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`leading-tight font-bold ${small ? 'text-base' : 'text-2xl'}`}
          style={hex ? { color: hex } : undefined}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
        {trendEmoji && <span className="text-lg" aria-hidden="true">{trendEmoji}</span>}
      </div>
      {sublabel && <p className="mt-1 text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}

export default StatCard;
