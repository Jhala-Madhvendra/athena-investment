/**
 * Shared custom tooltip for line charts: value leads (Strong, high-contrast),
 * series name is secondary, series identity is a short line-key (never a
 * filled box) - per the dataviz skill's interaction spec.
 */
function ChartTooltip({ active, payload, label, formatter = (v) => v }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-xs font-semibold text-slate-500">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
            <span
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-slate-500">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-900">
              {entry.value === null || entry.value === undefined ? '—' : formatter(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChartTooltip;
