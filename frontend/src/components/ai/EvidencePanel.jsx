/**
 * Renders the Athena context fields a report section's interpretation was
 * based on, e.g. "Based on: Return On Equity, Intrinsic Value Per Share".
 * Paths are dot-notation context field paths from the backend's evidence
 * allow-list (ai.contextBuilder.buildEvidenceAllowList) - every path shown
 * here is guaranteed to be a real Athena metric, never invented by the AI
 * (ai.validator.js strips any path not in the allow-list server-side).
 */
const humanizeEvidencePath = (path) => {
  const lastSegment = path.split('.').pop();
  return lastSegment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
};

function EvidencePanel({ paths }) {
  if (!paths || paths.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-ink-muted">Based on:</span>
      {paths.map((path) => (
        <span
          key={path}
          title={path}
          className="rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-xs text-ink-secondary"
        >
          {humanizeEvidencePath(path)}
        </span>
      ))}
    </div>
  );
}

export default EvidencePanel;
