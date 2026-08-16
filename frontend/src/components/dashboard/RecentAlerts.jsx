import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import Card from '../ui/Card'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'
import Badge from '../ui/Badge'
import { fetchJson } from '../../lib/api'
import { severityTone, typeLabel } from '../../lib/alertsFormat'
import { formatRelativeTime } from '../../lib/newsFormat'

const RECENT_LIMIT = 5

/**
 * Company Dashboard's "Recent Alerts" panel - the sprint brief's "Recent
 * Developments" example. Reuses GET /api/alerts?ticker=X (the same
 * paginated list the Alert Center uses) rather than a dedicated endpoint -
 * a company-scoped page of alerts is already exactly what that endpoint
 * returns.
 */
function RecentAlerts({ ticker }) {
  const [alerts, setAlerts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ ticker, limit: String(RECENT_LIMIT) })
        const data = await fetchJson(`/api/alerts?${params.toString()}`, undefined, controller.signal)
        setAlerts(data.alerts || [])
        setTotal(data.total || 0)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [ticker])

  return (
    <Card
      title="Recent Alerts"
      action={
        <Link to={`/alerts?ticker=${encodeURIComponent(ticker)}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          View All Alerts →
        </Link>
      }
    >
      {loading && <Skeleton variant="text" count={3} />}

      {!loading && error && <p className="text-sm text-ink-muted">Alerts are unavailable right now.</p>}

      {!loading && !error && alerts.length === 0 && (
        <EmptyState icon={Bell} title="No recent alerts" message={`Nothing meaningful has been detected yet for ${ticker}.`} />
      )}

      {!loading && !error && alerts.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-ink-secondary">
            {total} alert{total === 1 ? '' : 's'} for {ticker}.
          </p>
          {alerts.map((alert) => (
            <div key={alert._id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{typeLabel(alert.type)}</Badge>
                  <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-ink">{alert.title}</p>
                <p className="text-xs text-ink-muted">{formatRelativeTime(alert.triggeredAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default RecentAlerts
