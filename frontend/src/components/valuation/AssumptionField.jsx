import SourceBadge from './SourceBadge';

/**
 * One editable DCF assumption. Percent-type fields (the default) are typed
 * and displayed in whole percent - e.g. the user types "8" for 8% - but
 * `onChange` always hands back the decimal (0.08) the backend expects, so
 * callers never juggle the conversion themselves.
 */
function AssumptionField({
  id,
  label,
  decimalValue,
  onChange,
  note,
  source,
  unit = '%',
  isPercent = true,
  min,
  max,
  step,
}) {
  const displayValue =
    decimalValue === null || decimalValue === undefined
      ? ''
      : isPercent
        ? Number((decimalValue * 100).toFixed(4))
        : decimalValue;

  const handleChange = (event) => {
    const raw = event.target.value;

    if (raw === '') {
      onChange(null);
      return;
    }

    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      return;
    }

    onChange(isPercent ? parsed / 100 : parsed);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="min-w-0 truncate text-xs font-semibold tracking-wide text-ink-muted uppercase" title={label}>
          {label}
        </label>
        {source && <SourceBadge source={source} />}
      </div>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          min={min}
          max={max}
          step={step ?? (isPercent ? 0.1 : 1)}
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 pr-10 text-sm text-ink tabular-nums focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

export default AssumptionField;
