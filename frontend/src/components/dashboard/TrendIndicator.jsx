import { getDirectionTier } from '../../lib/scoreTokens';

const EMOJI = { '↑': '📈', '↓': '📉', '→': '➡️', '⚠': '⚠️', '?': '❓' };
const LABEL = { '↑': 'Improving', '↓': 'Declining', '→': 'Stable', '⚠': 'Volatile', '?': 'Unknown' };

/**
 * Direction chip (arrow + label) shared by any row that surfaces a trend
 * direction from the analysis engine's {direction} shape.
 * invert: true when a falling value is the good outcome (e.g. debt).
 */
function TrendIndicator({ direction, invert = false, className = '' }) {
  const tier = getDirectionTier(direction, invert);

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${className}`} style={{ color: tier.hex }}>
      <span aria-hidden="true">{EMOJI[direction] || '❓'}</span>
      {LABEL[direction] || 'Unknown'}
    </span>
  );
}

export default TrendIndicator;
