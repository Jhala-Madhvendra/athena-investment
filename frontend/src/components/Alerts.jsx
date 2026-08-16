import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, RefreshCw, X } from 'lucide-react'
import Card from './ui/Card'
import SectionHeader from './ui/SectionHeader'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import EmptyState from './ui/EmptyState'
import AlertCard from './alerts/AlertCard'
import AlertFilters from './alerts/AlertFilters'
import { fetchJson } from '../lib/api'
import { notifyAlertsChanged } from '../lib/alertsBadge'

const PAGE_LIMIT = 20

/**
 * Alert Center - "what changed that deserves my attention" (Sprint 11's
 * core product question). Monitoring is a deliberate, rate-limited action
 * ("Check for New Alerts"), not something fired on every page load - same
 * explicit-checkpoint pattern as Watchlist's "Check What's Changed"
 * (see backend/alerts/alert.routes.js's monitorLimiter).
 */
function Alerts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tickerFilter = searchParams.get('ticker')

  const [alerts, setAlerts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [unreadCount, setUnreadCount] = useState(0)
  const [dismissingId, setDismissingId] = useState(null)

  const [monitoring, setMonitoring] = useState(false)
  const [monitorMessage, setMonitorMessage] = useState('')
  const [monitorError, setMonitorError] = useState('')

  const loadUnreadCount = async () => {
    try {
      const data = await fetchJson('/api/alerts/unread-count')
      setUnreadCount(data.count || 0)
    } catch {
      // Non-critical - the count just stays at its last known value.
    }
  }

  const loadAlerts = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: String(PAGE_LIMIT), page: String(page) })
      if (filter.type) params.set('type', filter.type)
      if (filter.unread) params.set('unread', 'true')
      if (tickerFilter) params.set('ticker', tickerFilter)

      const data = await fetchJson(`/api/alerts?${params.toString()}`, undefined, signal)
      setAlerts(data.alerts || [])
      setTotal(data.total || 0)
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError(requestError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = () => loadAlerts(controller.signal)
    load()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, tickerFilter])

  useEffect(() => {
    const load = () => loadUnreadCount()
    load()
  }, [])

  const handleFilterChange = (nextFilter) => {
    setFilter(nextFilter)
    setPage(1)
  }

  const handleRead = async (alertId) => {
    setAlerts((current) => current.map((alert) => (alert._id === alertId ? { ...alert, isRead: true } : alert)))
    setUnreadCount((count) => Math.max(0, count - 1))
    try {
      await fetchJson(`/api/alerts/${alertId}/read`, { method: 'PATCH' })
      notifyAlertsChanged() // tells Sidebar's badge (a sibling, not a child - see alertsBadge.js) to re-fetch
    } catch {
      // Best-effort - a failed read-state sync isn't worth interrupting the user for.
    }
  }

  const handleDismiss = async (alertId) => {
    setDismissingId(alertId)
    try {
      await fetchJson(`/api/alerts/${alertId}/dismiss`, { method: 'PATCH' })
      setAlerts((current) => current.filter((alert) => alert._id !== alertId))
      setTotal((count) => Math.max(0, count - 1))
      loadUnreadCount()
      notifyAlertsChanged() // tells Sidebar's badge (a sibling, not a child - see alertsBadge.js) to re-fetch
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDismissingId(null)
    }
  }

  const handleMonitor = async () => {
    setMonitoring(true)
    setMonitorMessage('')
    setMonitorError('')
    try {
      const data = await fetchJson('/api/alerts/monitor', { method: 'POST' })
      const tickerCount = data.tickersMonitored?.length || 0
      setMonitorMessage(
        data.alertsCreated > 0
          ? `Found ${data.alertsCreated} new alert${data.alertsCreated === 1 ? '' : 's'} across ${tickerCount} tracked ticker${tickerCount === 1 ? '' : 's'}.`
          : `No new alerts across ${tickerCount} tracked ticker${tickerCount === 1 ? '' : 's'}.`
      )
      setPage(1)
      await Promise.all([loadAlerts(), loadUnreadCount()])
      notifyAlertsChanged() // new alerts may have been created - tells Sidebar's badge to re-fetch too
    } catch (requestError) {
      setMonitorError(requestError.message)
    } finally {
      setMonitoring(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Alerts"
        description="Meaningful changes in the companies you're tracking - not every price tick or headline."
        action={
          <button
            type="button"
            onClick={handleMonitor}
            disabled={monitoring}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${monitoring ? 'animate-spin' : ''}`} aria-hidden="true" />
            {monitoring ? 'Checking…' : 'Check for New Alerts'}
          </button>
        }
      />

      {tickerFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 bg-brand-500 px-3 py-1.5 text-xs font-medium text-white">
            Filtered to {tickerFilter}
            <button
              type="button"
              onClick={() => {
                setSearchParams((current) => {
                  const next = new URLSearchParams(current)
                  next.delete('ticker')
                  return next
                })
                setPage(1)
              }}
              aria-label={`Clear ${tickerFilter} filter`}
              className="rounded-full hover:bg-white/20"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      {monitorMessage && (
        <p className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-ink-secondary">{monitorMessage}</p>
      )}
      {monitorError && (
        <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{monitorError}</p>
      )}

      <AlertFilters active={filter} unreadCount={unreadCount} onChange={handleFilterChange} />

      <Card padded={false}>
        <div className="p-5">
          {loading && <Skeleton variant="card" count={3} />}

          {!loading && error && <ErrorState title="Couldn't load alerts" message={error} />}

          {!loading && !error && alerts.length === 0 && (
            <EmptyState
              icon={Bell}
              title="No alerts"
              message="Nothing meaningful has been detected yet. Track companies on your Watchlist or Portfolio, then check for new alerts."
            />
          )}

          {!loading && !error && alerts.length > 0 && (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertCard key={alert._id} alert={alert} onRead={handleRead} onDismiss={handleDismiss} dismissing={dismissingId === alert._id} />
              ))}
            </div>
          )}
        </div>

        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-ink-muted">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-md px-2 py-1 hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="rounded-md px-2 py-1 hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </Card>

      <p className="text-xs text-ink-muted">
        Alerts are generated deterministically from Athena's own data - not investment advice or a recommendation to buy or sell.
      </p>
    </div>
  )
}

export default Alerts
