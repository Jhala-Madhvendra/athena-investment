/**
 * Score -> sentiment tier resolver
 * Single source of truth for the 5-tier health/component score bands
 * (thresholds preserved exactly from the original getScoreColor logic)
 */
const SCORE_TIERS = [
  { min: 90, tier: 'excellent', label: 'Excellent', hex: '#006300', hexLight: '#d6f5d6', className: 'excellent' },
  { min: 75, tier: 'good', label: 'Good', hex: '#0ca30c', hexLight: '#d6f5d6', className: 'good' },
  { min: 50, tier: 'average', label: 'Average', hex: '#fab219', hexLight: '#fdecc8', className: 'warning' },
  { min: 25, tier: 'weak', label: 'Weak', hex: '#ec835a', hexLight: '#fbe0d0', className: 'serious' },
  { min: 0, tier: 'poor', label: 'Poor', hex: '#d03b3b', hexLight: '#fbdada', className: 'critical' },
];

const UNKNOWN_TIER = { tier: 'unknown', label: 'Unknown', hex: '#898781', hexLight: '#e5e4de', className: 'neutral' };

/**
 * Resolve a 0-100 score to its sentiment tier
 * @param {number|null|undefined} score
 * @returns {{tier: string, label: string, hex: string, hexLight: string, className: string}}
 */
export function getScoreTier(score) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return UNKNOWN_TIER;
  }
  return SCORE_TIERS.find((t) => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

/**
 * Resolve a 3-state sentiment (used by signChange.positive: true/false/null) to a tier
 * @param {boolean|null|undefined} positive
 * @returns {{hex: string, hexLight: string, className: string}}
 */
export function getSentimentTier(positive) {
  if (positive === true) return { hex: '#0ca30c', hexLight: '#d6f5d6', className: 'good' };
  if (positive === false) return { hex: '#d03b3b', hexLight: '#fbdada', className: 'critical' };
  return { hex: '#898781', hexLight: '#e5e4de', className: 'neutral' };
}

/**
 * Resolve a trend direction (↑/↓/→/⚠/?) to a tier. Direction alone doesn't carry
 * good/bad meaning (e.g. rising debt is bad, rising revenue is good) - callers
 * that need sentiment should use invert to flip improving/declining.
 * @param {string} direction
 * @param {boolean} invert - true when a falling value is the good outcome (e.g. debt)
 */
export function getDirectionTier(direction, invert = false) {
  if (direction === '↑') return invert ? { hex: '#d03b3b', className: 'critical' } : { hex: '#0ca30c', className: 'good' };
  if (direction === '↓') return invert ? { hex: '#0ca30c', className: 'good' } : { hex: '#d03b3b', className: 'critical' };
  if (direction === '⚠') return { hex: '#fab219', className: 'warning' };
  return { hex: '#898781', className: 'neutral' };
}
