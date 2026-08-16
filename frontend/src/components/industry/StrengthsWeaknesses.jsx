import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatDifference } from '../../lib/industryFormat';

/**
 * Relative strengths/weaknesses - deterministic classification only (see
 * industry.benchmark.js's classifyPosition), never AI-judged. Renders
 * nothing for an empty list rather than an empty card shell, since "no
 * material differences from the industry median" is itself informative and
 * shouldn't look like a loading/error state.
 */
function StrengthsWeaknesses({ strengths, weaknesses }) {
  if ((!strengths || strengths.length === 0) && (!weaknesses || weaknesses.length === 0)) {
    return <p className="text-sm text-ink-muted">No metric differs materially from the industry median.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <TrendingUp className="h-4 w-4 text-good" aria-hidden="true" />
          Relative Strengths
        </h4>
        {strengths && strengths.length > 0 ? (
          <ul className="space-y-1.5">
            {strengths.map((entry) => (
              <li key={entry.metric} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-secondary">{entry.label}</span>
                <span className="shrink-0 tabular-nums font-medium text-good">{formatDifference(entry.difference)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">None above the industry median by a material margin.</p>
        )}
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <TrendingDown className="h-4 w-4 text-critical" aria-hidden="true" />
          Relative Weaknesses
        </h4>
        {weaknesses && weaknesses.length > 0 ? (
          <ul className="space-y-1.5">
            {weaknesses.map((entry) => (
              <li key={entry.metric} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-secondary">{entry.label}</span>
                <span className="shrink-0 tabular-nums font-medium text-critical">{formatDifference(entry.difference)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">None below the industry median by a material margin.</p>
        )}
      </div>
    </div>
  );
}

export default StrengthsWeaknesses;
