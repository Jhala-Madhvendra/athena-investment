const OPTIONS = [
  { key: 'mean', label: 'Mean' },
  { key: 'median', label: 'Median' },
  { key: 'p25', label: '25th Percentile' },
  { key: 'p75', label: '75th Percentile' },
];

/**
 * Which peer statistic gets applied to the target. Defaults to Median
 * (see ValuationMultiples.md) - a single extreme peer multiple shifts a
 * mean by its full distance from the rest of the group, but can shift a
 * median by at most one rank.
 */
function StatisticSelector({ value, onChange }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Peer Statistic Applied to Target</p>
      <div role="radiogroup" aria-label="Peer statistic" className="mt-1.5 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface-sunken p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={value === option.key}
            onClick={() => onChange(option.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              value === option.key ? 'bg-surface-raised text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        Median is the default because it is far less sensitive to a single outlier peer than the mean.
      </p>
    </div>
  );
}

export default StatisticSelector;
