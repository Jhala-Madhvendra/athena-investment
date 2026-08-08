import Badge from '../ui/Badge';

/**
 * Single insight row (category badge + confidence + text + forward-looking
 * note), styled after BusinessAnalysis.jsx's inline insight card. Purely
 * presentational - insight text/confidence/category all come pre-computed
 * from the analysis engine, nothing is generated here.
 */
function InsightCard({ insight }) {
  return (
    <div className="rounded-lg border-l-4 border-brand-500 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="brand">{insight.categoryLabel}</Badge>
        {insight.confidence != null && (
          <span className="text-xs font-medium text-slate-500">{insight.confidence}% confident</span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-800">{insight.text}</p>
      {insight.forward && <p className="mt-2 text-xs text-slate-500 italic">💡 {insight.forward}</p>}
    </div>
  );
}

export default InsightCard;
