import { TrendingUp, TrendingDown, Minus, AlertTriangle, HelpCircle } from 'lucide-react';
import { getDirectionTier } from '../../lib/scoreTokens';

const ICON = { '↑': TrendingUp, '↓': TrendingDown, '→': Minus, '⚠': AlertTriangle, '?': HelpCircle };
const LABEL = { '↑': 'Improving', '↓': 'Declining', '→': 'Stable', '⚠': 'Volatile', '?': 'Unknown' };

/**
 * Direction chip (arrow + label) shared by any row that surfaces a trend
 * direction from the analysis engine's {direction} shape.
 * invert: true when a falling value is the good outcome (e.g. debt).
 */
function TrendIndicator({ direction, invert = false, className = '' }) {
  const tier = getDirectionTier(direction, invert);
  const Icon = ICON[direction] || HelpCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${className}`} style={{ color: tier.hex }}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {LABEL[direction] || 'Unknown'}
    </span>
  );
}

export default TrendIndicator;
