import Badge from '../ui/Badge';

/**
 * Labels where a pre-filled DCF assumption came from. The DCF sprint
 * requires every assumption to visibly distinguish Historical / Derived /
 * Market / Default / Illustrative / Required-input so a user never mistakes
 * a textbook illustrative figure (e.g. a 5% equity risk premium) for live
 * market data (e.g. beta from Yahoo) or a company's own reported financials.
 */
const SOURCE_META = {
  historical: { label: 'Historical', tone: 'neutral' },
  derived: { label: 'Derived', tone: 'good' },
  market: { label: 'Live Market Data', tone: 'brand' },
  default: { label: 'Default', tone: 'neutral' },
  illustrative_default: { label: 'Illustrative — Not Live Data', tone: 'warning' },
  required_user_input: { label: 'Enter a Value', tone: 'critical' },
  unavailable: { label: 'Unavailable', tone: 'warning' },
};

function SourceBadge({ source }) {
  const meta = SOURCE_META[source] || SOURCE_META.default;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export default SourceBadge;
