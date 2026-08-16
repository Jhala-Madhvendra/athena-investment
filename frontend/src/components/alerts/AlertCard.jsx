import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react'
import Badge from '../ui/Badge'
import { severityTone, typeLabel, formatMetricValue } from '../../lib/alertsFormat'
import { formatRelativeTime, formatAbsoluteDateTime } from '../../lib/newsFormat'

/**
 * One alert. Collapsed shows what happened + why it matters (the sprint
 * brief's card mock); expanding reveals the evidence a user needs to
 * verify it for themselves (previous/current/% change/period/source) and
 * marks it read - the same "viewing is the read signal" most notification
 * centers use, so there's no separate "mark read" click required.
 */
function AlertCard({ alert, onRead, onDismiss, dismissing }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const toggleExpanded = () => {
    const next = !expanded
    setExpanded(next)
    if (next && !alert.isRead) onRead(alert._id)
  }

  const hasEvidence = alert.previousValue !== null || alert.currentValue !== null || alert.evidencePeriod

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        alert.isRead ? 'border-border bg-surface-raised' : 'border-brand-500/30 bg-brand-500/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={toggleExpanded} className="flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{alert.ticker}</span>
            <Badge tone="brand">{typeLabel(alert.type)}</Badge>
            <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>
            {!alert.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">{alert.title}</p>
          <p className="mt-0.5 text-sm text-ink-secondary">{alert.message}</p>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleExpanded}
            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
            aria-label={expanded ? 'Collapse alert details' : 'Expand alert details'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(alert._id)}
            disabled={dismissing}
            className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Dismiss alert"
            title="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <span title={formatAbsoluteDateTime(alert.triggeredAt)}>{formatRelativeTime(alert.triggeredAt)}</span>
        {alert.source && <span>· {alert.source}</span>}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Why it matters</p>
            <p className="mt-1 text-sm text-ink-secondary">{alert.whyItMatters}</p>
          </div>

          {hasEvidence && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {alert.previousValue !== null && alert.previousValue !== undefined && (
                <div>
                  <p className="text-xs text-ink-muted">Previous</p>
                  <p className="text-sm font-semibold text-ink">{formatMetricValue(alert.previousValue)}</p>
                </div>
              )}
              {alert.currentValue !== null && alert.currentValue !== undefined && (
                <div>
                  <p className="text-xs text-ink-muted">Current</p>
                  <p className="text-sm font-semibold text-ink">{formatMetricValue(alert.currentValue)}</p>
                </div>
              )}
              {alert.percentChange !== null && alert.percentChange !== undefined && (
                <div>
                  <p className="text-xs text-ink-muted">Change</p>
                  <p className="text-sm font-semibold text-ink">
                    {alert.percentChange > 0 ? '+' : ''}
                    {formatMetricValue(alert.percentChange)}%
                  </p>
                </div>
              )}
              {alert.evidencePeriod && (
                <div>
                  <p className="text-xs text-ink-muted">Period</p>
                  <p className="text-sm font-semibold text-ink">{alert.evidencePeriod}</p>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate(`/financials/${encodeURIComponent(alert.ticker)}/overview`)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:underline"
          >
            View Company
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

export default AlertCard
