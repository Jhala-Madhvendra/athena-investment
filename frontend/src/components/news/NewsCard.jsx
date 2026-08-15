import { ExternalLink } from 'lucide-react'
import Badge from '../ui/Badge'
import { formatRelativeTime, formatAbsoluteDateTime } from '../../lib/newsFormat'

/**
 * One news article. Always links out to the original source rather than
 * reproducing the article - see Sprint 10's source-traceability
 * requirement. Title, source, and publish date are the only facts
 * asserted here; everything else (category) is Athena's own
 * classification, badged separately so it's never confused with the
 * article's own content.
 */
function NewsCard({ article }) {
  const relative = formatRelativeTime(article.publishedAt)
  const absolute = formatAbsoluteDateTime(article.publishedAt)

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-brand-500/40 hover:bg-surface-sunken/40"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{article.title}</h3>
        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      </div>

      {article.description && <p className="mt-1.5 text-sm text-ink-secondary">{article.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone="brand">{article.category}</Badge>
        {article.source && <span className="text-xs text-ink-muted">{article.source}</span>}
        {relative && (
          <span className="text-xs text-ink-muted" title={absolute}>
            · Published {relative}
          </span>
        )}
      </div>
    </a>
  )
}

export default NewsCard
