/**
 * Renders the Athena context fields (or, for "Recent Developments", the
 * source article urls) a report section's interpretation was based on,
 * e.g. "Based on: Return On Equity, Intrinsic Value Per Share". Every
 * entry comes from the backend's evidence allow-list
 * (ai.contextBuilder.buildEvidenceAllowList) - guaranteed either a real
 * Athena metric or a real stored article url, never invented by the AI
 * (ai.validator.js strips anything not in the allow-list server-side).
 */
const isUrl = (path) => /^https?:\/\//i.test(path);

const humanizeEvidencePath = (path) => {
  const lastSegment = path.split('.').pop();
  return lastSegment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
};

/** A hostname short enough for a chip, e.g. "reuters.com" from a full article url. */
const hostnameFor = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function EvidencePanel({ paths }) {
  if (!paths || paths.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-ink-muted">Based on:</span>
      {paths.map((path) =>
        isUrl(path) ? (
          <a
            key={path}
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            title={path}
            className="rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-xs text-brand-600 hover:underline"
          >
            {hostnameFor(path)} ↗
          </a>
        ) : (
          <span
            key={path}
            title={path}
            className="rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-xs text-ink-secondary"
          >
            {humanizeEvidencePath(path)}
          </span>
        )
      )}
    </div>
  );
}

export default EvidencePanel;
