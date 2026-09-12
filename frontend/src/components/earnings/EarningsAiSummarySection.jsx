import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import Card from '../ui/Card'
import ReportSection from '../ai/ReportSection'
import { fetchJson } from '../../lib/api'

/**
 * On-demand AI narrative summary of the earnings scorecard above - same
 * "Generate/Regenerate, never auto-fires" discipline as AIResearch.jsx (see
 * research/engineering/GroundedEarningsExplanation.md). Cached per ticker +
 * fiscal year on the backend (backend/earnings/earningsAiSummary.model.js),
 * so a newer fiscal year's imported earnings naturally produce a fresh
 * summary on the next click rather than serving a stale one.
 */
function EarningsAiSummarySection({ ticker, fiscalYearKey }) {
  const [initialLoading, setInitialLoading] = useState(true)
  const [summary, setSummary] = useState(null)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const checkForExistingSummary = async () => {
      setInitialLoading(true)
      setSummary(null)
      try {
        const data = await fetchJson(`/api/earnings/${encodeURIComponent(ticker)}/summary`, undefined, controller.signal)
        setSummary(data)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setSummary(null)
      } finally {
        if (!controller.signal.aborted) setInitialLoading(false)
      }
    }

    checkForExistingSummary()
    return () => controller.abort()
  }, [ticker, fiscalYearKey])

  const handleGenerate = async (regenerate) => {
    setGenerating(true)
    setGenerateError('')
    try {
      const data = await fetchJson(`/api/earnings/${encodeURIComponent(ticker)}/summary`, {
        method: 'POST',
        body: JSON.stringify({ regenerate }),
      })
      setSummary(data)
    } catch (requestError) {
      setGenerateError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setGenerating(false)
    }
  }

  if (initialLoading) {
    return null
  }

  if (!summary) {
    return (
      <Card title="AI Summary">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="max-w-md text-sm text-ink-muted">
            Athena can narrate this earnings scorecard using only the figures already shown above - never a
            calculation of its own, never buy/sell advice.
          </p>
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {generating ? 'Generating…' : 'Generate AI Summary'}
          </button>
          {generateError && <p className="max-w-md text-sm text-critical">{generateError}</p>}
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="AI Summary"
      action={
        <button
          type="button"
          onClick={() => handleGenerate(true)}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} aria-hidden="true" />
          {generating ? 'Regenerating…' : 'Regenerate'}
        </button>
      }
    >
      {generateError && <p className="mb-3 text-sm text-critical">{generateError}</p>}
      <ReportSection title="Earnings Summary" text={summary.narrative} evidence={summary.evidenceUsed} />
    </Card>
  )
}

export default EarningsAiSummarySection
