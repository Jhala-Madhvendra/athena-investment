import StatCard from '../ui/StatCard';
import EmptyState from '../ui/EmptyState';
import { Scale } from 'lucide-react';
import { formatPerShare } from '../../lib/compsFormat';

/**
 * DCF (intrinsic valuation) vs. Comps (relative valuation) vs. current
 * market price, side by side. Athena never declares one "correct" - they
 * answer different questions (see research/finance/ComparableCompanyAnalysis.md),
 * and are expected to disagree.
 */
function DCFComparisonCard({ dcfResult, compsValuationRange, compsCurrentMarketPrice, currency }) {
  if (!dcfResult) {
    return (
      <EmptyState
        icon={Scale}
        title="No DCF valuation to compare yet"
        message="Run a DCF valuation in the DCF Valuation tab, then return here to see it compared against this Comparable Company Analysis."
      />
    );
  }

  const { low, median, high, methodologiesApplied } = compsValuationRange || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="DCF Intrinsic Value / Share"
          value={formatPerShare(dcfResult.intrinsicValuePerShare, currency)}
          sublabel="Discounted cash flow"
        />
        <StatCard
          label="Comps Valuation Range"
          value={methodologiesApplied ? `${formatPerShare(low, currency)} – ${formatPerShare(high, currency)}` : '—'}
          sublabel={methodologiesApplied ? `Median ${formatPerShare(median, currency)}` : 'No applicable methodology'}
          hex="#2a78d6"
        />
        <StatCard
          label="Current Market Price"
          value={formatPerShare(compsCurrentMarketPrice ?? dcfResult.currentMarketPrice, currency)}
        />
      </div>

      <div className="rounded-lg border border-warning/30 bg-warning-light/40 p-4">
        <p className="text-xs leading-relaxed text-ink-secondary">
          DCF is an <strong className="font-semibold text-ink">intrinsic valuation</strong> method — it estimates
          what the business is worth based on its own projected future cash flows. Comparable Company Analysis is a{' '}
          <strong className="font-semibold text-ink">relative valuation</strong> method — it estimates what the
          market is currently paying for similar businesses. Differences between the two are expected and do not
          mean either one is wrong; Athena does not select or recommend one over the other.
        </p>
      </div>
    </div>
  );
}

export default DCFComparisonCard;
