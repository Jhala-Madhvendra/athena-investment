/**
 * A single ratio against a limit (0-100 score, weighting %, etc).
 * Fill carries severity; the unfilled track is a lighter step of the same
 * ramp (never flat gray), per the dataviz skill's Meter spec.
 */
function Meter({ value, max = 100, label, hex = '#2a78d6', hexLight = '#e5e4de', showValue = true, valueSuffix = '', className = '' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
          {label && <span className="font-medium text-slate-700">{label}</span>}
          {showValue && (
            <span className="tabular-nums font-semibold text-slate-900">
              {Math.round(value)}
              {valueSuffix}
            </span>
          )}
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: hexLight }}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: hex }}
        />
      </div>
    </div>
  );
}

export default Meter;
