const TONE_HEX = {
  brand: '#2a78d6',
  excellent: '#006300',
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  neutral: '#898781',
};

/**
 * Small pill badge. Sentiment is carried by a colored dot, never by coloring
 * the text itself (status hues like warning/serious fail text contrast on
 * a light surface) - text always stays neutral ink.
 */
function Badge({ tone = 'neutral', children, className = '' }) {
  const dot = TONE_HEX[tone] ?? TONE_HEX.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-secondary ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} aria-hidden="true" />
      {children}
    </span>
  );
}

export default Badge;
