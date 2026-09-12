import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import Card from './ui/Card'
import { fetchJson } from '../lib/api'

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

/**
 * Read-only - the digest is generated only by backend/jobs/portfolioDigestJob.js
 * on a weekly schedule (see backend/ai/portfolioDigest.service.js's "not
 * gated by the shared AI quota pool, bounded by opt-in + weekly cadence
 * instead" reasoning). This card never triggers generation, only shows the
 * latest persisted one, or a prompt to opt in.
 */
function PortfolioDigestCard() {
  const [digest, setDigest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetchJson('/api/ai/digest', undefined, controller.signal)
      .then((data) => setDigest(data))
      .catch((error) => {
        if (error.name !== 'AbortError') setDigest(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  if (loading) {
    return null
  }

  if (!digest) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <Sparkles className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
          <span>
            No weekly digest yet - enable it in{' '}
            <Link to="/account" className="font-semibold text-brand-600 hover:underline">
              Account settings
            </Link>
            .
          </span>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Weekly Digest" eyebrow={formatDate(digest.generatedAt)}>
      <p className="text-sm leading-relaxed text-ink-secondary">{digest.narrative}</p>
      {digest.holdingHighlights?.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {digest.holdingHighlights.map((highlight) => (
            <li key={highlight.ticker} className="text-sm text-ink-secondary">
              <span className="font-semibold text-ink">{highlight.ticker}:</span> {highlight.note}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default PortfolioDigestCard
