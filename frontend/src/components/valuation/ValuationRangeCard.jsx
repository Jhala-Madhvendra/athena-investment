import StatCard from '../ui/StatCard';
import { formatPerShare } from '../../lib/compsFormat';

/**
 * Low/Median/High implied value per share across every applicable
 * methodology, next to the current market price - never collapsed into a
 * single "recommended" number (see comps.engine.js's valuationRange,
 * which deliberately has no such field).
 */
function ValuationRangeCard({ valuationRange, currentMarketPrice, currency }) {
  const { low, median, high, methodologiesApplied } = valuationRange || {};

  if (!methodologiesApplied) {
    return (
      <p className="text-sm text-ink-muted">
        No methodology produced an applicable Implied Value Per Share for the current peer selection - see the
        Implied Valuation table above for why each multiple was not applicable.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="Low" value={formatPerShare(low, currency)} />
        <StatCard label="Median" value={formatPerShare(median, currency)} hex="#2a78d6" />
        <StatCard label="High" value={formatPerShare(high, currency)} />
        <StatCard label="Current Market Price" value={formatPerShare(currentMarketPrice, currency)} />
      </div>
      <p className="text-xs leading-relaxed text-ink-muted">
        This range is derived from {methodologiesApplied} applicable methodolog{methodologiesApplied === 1 ? 'y' : 'ies'}{' '}
        under the selected comparable companies and peer statistic — it is not a guaranteed future price, and Athena
        does not average these into a single number or select the highest value.
      </p>
    </div>
  );
}

export default ValuationRangeCard;
