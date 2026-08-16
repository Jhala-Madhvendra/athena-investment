import StatCard from '../ui/StatCard'
import { formatPercent } from '../../lib/earningsFormat'

/**
 * Shows how the stock moved after the earnings-adjacent date Athena could
 * identify - never the phrase "earnings release date" (Athena has no such
 * field; see backend/earnings/earnings.marketReaction.js's header comment
 * for why it anchors on the most recent Earnings-category news article
 * instead). Deliberately never claims causation - see the "basis" caption
 * and research/finance/MarketReaction.md.
 */
function MarketReactionCard({ marketReaction }) {
  if (!marketReaction?.available) {
    return (
      <p className="text-sm text-ink-muted">
        {marketReaction?.reason || 'Market reaction is not available for this company yet.'}
      </p>
    )
  }

  const anchorDateLabel = marketReaction.anchorDate
    ? new Date(marketReaction.anchorDate).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="1-Day Return" value={formatPercent(marketReaction.oneDayReturnPercent)} />
        <StatCard label="5-Day Return" value={formatPercent(marketReaction.fiveDayReturnPercent)} />
      </div>
      <p className="text-xs text-ink-muted">
        Measured from {anchorDateLabel || 'the reference date below'} - {marketReaction.basis}. Shares moved this much
        following that date; this does not mean earnings caused the move.
      </p>
    </div>
  )
}

export default MarketReactionCard
