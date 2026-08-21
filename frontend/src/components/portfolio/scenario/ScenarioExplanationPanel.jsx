import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import Card from '../../ui/Card'
import ErrorState from '../../ui/ErrorState'
import { fetchJson } from '../../../lib/api'

/**
 * Opt-in AI explanation of an already-computed scenario result - never
 * fetched automatically. Mirrors the AI Research Analyst page's
 * generate-on-click pattern (frontend/src/components/AIResearch.jsx):
 * the LLM is only ever called from an explicit click, and the panel only
 * ever sends the structured `result` this component already has - it does
 * not let the user type free-form questions or pass anything else to the
 * backend. See research/engineering/GroundedScenarioExplanation.md.
 */
function ScenarioExplanationPanel({ result }) {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExplain = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchJson('/api/portfolio/scenarios/explain', {
        method: 'POST',
        body: JSON.stringify(result),
      })
      setExplanation(data.explanation)
    } catch (requestError) {
      setError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title="AI Explanation"
      eyebrow="Restates the numbers above - not a new analysis"
      action={
        <button
          type="button"
          onClick={handleExplain}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? 'Explaining…' : explanation ? 'Re-explain' : 'Explain this result'}
        </button>
      }
    >
      {error && <ErrorState title="Couldn't generate explanation" message={error} />}

      {!error && explanation && <p className="text-sm leading-relaxed text-ink">{explanation}</p>}

      {!error && !explanation && !loading && (
        <p className="text-sm text-ink-muted">
          Ask AI to explain this scenario's result in plain English - it only restates figures already shown above, never
          new numbers, forecasts, or recommendations.
        </p>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        AI-generated explanation of the numbers above - not financial advice, not a forecast.
      </p>
    </Card>
  )
}

export default ScenarioExplanationPanel
