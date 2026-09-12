import { useState } from 'react'
import { Bell } from 'lucide-react'
import { fetchJson } from '../../../lib/api'

/**
 * Appears next to an already-run scenario's result - "Scenario Watch": lets
 * the user save this scenario's definition so backend/jobs/scenarioWatchJob.js
 * re-checks it against their LIVE portfolio on a schedule and alerts them
 * if real conditions cross the threshold. Never re-runs the scenario itself
 * here - POSTs the same {name, rules, benchmark, window} the just-run
 * request already used.
 */
function SaveScenarioButton({ name, rules, benchmark, window: windowValue, defaultThresholdPercent, onSaved }) {
  const [open, setOpen] = useState(false)
  const [threshold, setThreshold] = useState(String(Math.round(defaultThresholdPercent ?? -15)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await fetchJson('/api/portfolio/scenarios/saved', {
        method: 'POST',
        body: JSON.stringify({
          name,
          rules,
          benchmark: benchmark || undefined,
          window: windowValue,
          alertThresholdPercent: Number(threshold),
        }),
      })
      setSaved(true)
      setOpen(false)
      onSaved?.()
    } catch (requestError) {
      setError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setSaved(false)
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken"
      >
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        {saved ? 'Saved to Scenario Watch' : 'Watch this scenario'}
      </button>
    )
  }

  return (
    <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-xs">
      <label htmlFor="watch-threshold" className="text-ink-secondary">
        Alert me if my live portfolio would lose at least
      </label>
      <input
        id="watch-threshold"
        type="number"
        step="1"
        max="-1"
        required
        value={threshold}
        onChange={(event) => setThreshold(event.target.value)}
        className="w-16 rounded-md border border-border bg-surface-raised px-2 py-1 text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
      />
      <span className="text-ink-secondary">% under this scenario.</span>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-brand-500 px-2.5 py-1 font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink">
        Cancel
      </button>
      {error && <p className="w-full text-critical">{error}</p>}
    </form>
  )
}

export default SaveScenarioButton
