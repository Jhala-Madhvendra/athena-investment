import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Card from '../../ui/Card'
import { fetchJson } from '../../../lib/api'

const formatPercent = (value) => (typeof value === 'number' ? `${value.toFixed(1)}%` : '—')
const formatDate = (value) => (value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not checked yet')

/**
 * Lists every scenario the user is watching (backend/jobs/scenarioWatchJob.js
 * re-checks each on a schedule against the live portfolio) - shows the most
 * recent check's result so a user can see how close they are to their own
 * threshold without waiting for a push notification.
 */
function SavedScenariosWatchlist({ refreshKey }) {
  const [savedScenarios, setSavedScenarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchJson('/api/portfolio/scenarios/saved')
      setSavedScenarios(data.savedScenarios || [])
    } catch {
      // Non-critical - the watchlist just stays empty/stale on a load failure.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch whenever a new scenario is saved
  }, [refreshKey])

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await fetchJson(`/api/portfolio/scenarios/saved/${id}`, { method: 'DELETE' })
      setSavedScenarios((prev) => prev.filter((s) => s._id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading || savedScenarios.length === 0) {
    return null
  }

  return (
    <Card title="Scenario Watch" eyebrow="Re-checked automatically against your live portfolio">
      <div className="space-y-2">
        {savedScenarios.map((saved) => {
          const crossed = typeof saved.lastPercentageChange === 'number' && saved.lastPercentageChange <= saved.alertThresholdPercent
          return (
            <div key={saved._id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{saved.name}</p>
                <p className="text-xs text-ink-muted">
                  Watching for at least {saved.alertThresholdPercent}% loss · last checked: {formatDate(saved.lastCheckedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`text-sm font-semibold tabular-nums ${crossed ? 'text-critical' : 'text-ink'}`}>
                  {formatPercent(saved.lastPercentageChange)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(saved._id)}
                  disabled={deletingId === saved._id}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Stop watching ${saved.name}`}
                  title="Stop watching"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default SavedScenariosWatchlist
