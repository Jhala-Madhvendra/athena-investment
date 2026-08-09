import { Lightbulb } from 'lucide-react';
import Badge from '../ui/Badge';

/**
 * Single insight row (category badge + confidence + text + forward-looking
 * note), styled after BusinessAnalysis.jsx's inline insight card. Purely
 * presentational - insight text/confidence/category all come pre-computed
 * from the analysis engine, nothing is generated here.
 */
function InsightCard({ insight }) {
  return (
    <div className="rounded-lg border border-border border-l-[3px] border-l-brand-500 bg-surface-sunken p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="brand">{insight.categoryLabel}</Badge>
        {insight.confidence != null && (
          <span className="text-xs font-medium text-ink-muted">{insight.confidence}% confident</span>
        )}
      </div>
      <p className="mt-2 text-sm text-ink">{insight.text}</p>
      {insight.forward && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted italic">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 not-italic" aria-hidden="true" />
          {insight.forward}
        </p>
      )}
    </div>
  );
}

export default InsightCard;
