import Badge from '../ui/Badge'

const SIGNAL_TONE = { Improving: 'good', Stable: 'neutral', Deteriorating: 'serious' }
const DIRECTION_ARROWS = ['↑', '↓', '→']

/**
 * Renders either an Improving/Stable/Deteriorating signal or a neutral
 * ↑/↓/→ direction (balance-sheet metrics never get the Improving/
 * Deteriorating framing - see backend/earnings/earnings.signals.js) with
 * the same neutral-text-colored-dot pattern every other Badge in Athena
 * uses. Renders a plain "Not available" when no comparison period exists.
 */
function SignalBadge({ signal }) {
  if (!signal) {
    return <span className="text-xs text-ink-muted">Not available</span>
  }

  const tone = DIRECTION_ARROWS.includes(signal) ? 'neutral' : (SIGNAL_TONE[signal] || 'neutral')

  return <Badge tone={tone}>{signal}</Badge>
}

export default SignalBadge
