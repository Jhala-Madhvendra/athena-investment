import { useState } from 'react'
import { Share2, Copy, Check, X } from 'lucide-react'
import { fetchJson } from '../lib/api'

/**
 * Creates a read-only share link (POST /api/snapshots) and shows it in an
 * inline popover with a copy button. `buildPayload` is only ever called at
 * click time, never on mount - this component fires no request on page
 * load, so dropping it into a page never changes that page's initial fetch
 * count (see SavedScenariosSection's own fix for the same issue).
 */
function ShareSnapshotButton({ type, label, buildPayload }) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    setOpen(true)
    setCreating(true)
    setError('')
    setCopied(false)
    try {
      const data = await fetchJson('/api/snapshots', {
        method: 'POST',
        body: JSON.stringify({ type, label, payload: buildPayload() }),
      })
      setShareUrl(`${window.location.origin}/share/${data.token}`)
    } catch (requestError) {
      setError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
    } catch {
      setError('Could not copy automatically - select and copy the link manually.')
    }
  }

  return (
    <div className="relative print:hidden">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Share
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-border bg-surface-raised p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Share Link</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {creating && <p className="text-sm text-ink-muted">Creating link…</p>}
          {error && <p className="text-sm text-critical">{error}</p>}

          {shareUrl && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  aria-label="Share link"
                  className="w-full rounded-lg border border-border bg-surface-sunken px-2.5 py-1.5 text-xs text-ink"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy link"
                  className="shrink-0 rounded-lg border border-border bg-surface-sunken p-1.5 text-ink-secondary hover:bg-surface-raised"
                >
                  {copied ? <Check className="h-4 w-4 text-good" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                Anyone with this link can view this snapshot - no account required. Values are frozen as of now, not live.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ShareSnapshotButton
