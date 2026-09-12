import { useEffect, useState } from 'react'
import { Plus, Trash2, X, CircleDollarSign } from 'lucide-react'
import Card from '../ui/Card'
import Skeleton from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'
import SectionHeader from '../ui/SectionHeader'
import Badge from '../ui/Badge'
import { fetchJson } from '../../lib/api'

const formatCurrency = (value) => {
  if (typeof value !== 'number') return '—'
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '—')
const toDateInputValue = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

const emptyFormValues = { ticker: '', amountPerShare: '', shares: '', payDate: '', reinvested: false, reinvestmentPrice: '' }

/** Live preview of shares acquired, mirroring dividend.validator.js's totalAmount/reinvestmentPrice math - purely a form convenience, the real figure is computed server-side on save. */
const previewSharesAcquired = (formValues) => {
  const amountPerShare = Number(formValues.amountPerShare)
  const shares = Number(formValues.shares)
  const reinvestmentPrice = Number(formValues.reinvestmentPrice)
  if (!formValues.reinvested || !Number.isFinite(amountPerShare) || !Number.isFinite(shares) || !reinvestmentPrice) return null
  return (amountPerShare * shares) / reinvestmentPrice
}

/**
 * Dividend income + reinvestment modeling (deliberately isolated from
 * Holding/Transaction - see dividend.model.js). Reinvested shares are
 * informational here, feeding the portfolio summary's total-return figure;
 * they don't change the Holdings list on their own.
 */
function DividendsSection({ portfolioId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dividends, setDividends] = useState([])

  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState(emptyFormValues)
  const [formError, setFormError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  const [deletingId, setDeletingId] = useState(null)
  const [rowError, setRowError] = useState('')

  const loadDividends = async (signal) => {
    if (!portfolioId) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchJson(`/api/dividends?portfolioId=${encodeURIComponent(portfolioId)}`, undefined, signal)
      setDividends(data.dividends || [])
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError(requestError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadDividends(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch whenever the selected account changes
  }, [portfolioId])

  const openAddForm = () => {
    setFormValues(emptyFormValues)
    setFormError('')
    setFormOpen(true)
  }

  const closeForm = () => setFormOpen(false)

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    setFormSubmitting(true)
    setFormError('')

    try {
      await fetchJson('/api/dividends', {
        method: 'POST',
        body: JSON.stringify({
          ticker: formValues.ticker,
          amountPerShare: Number(formValues.amountPerShare),
          shares: Number(formValues.shares),
          payDate: formValues.payDate,
          reinvested: formValues.reinvested,
          reinvestmentPrice: formValues.reinvested ? Number(formValues.reinvestmentPrice) : undefined,
          portfolioId,
        }),
      })
      closeForm()
      await loadDividends()
    } catch (requestError) {
      setFormError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = async (dividend) => {
    setDeletingId(dividend._id)
    setRowError('')
    try {
      await fetchJson(`/api/dividends/${dividend._id}`, { method: 'DELETE' })
      await loadDividends()
    } catch (requestError) {
      setRowError(requestError.message)
    } finally {
      setDeletingId(null)
    }
  }

  const addButton = (
    <button
      type="button"
      onClick={openAddForm}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Record Dividend
    </button>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Dividends" description="Income received, and how much of it was reinvested." />
        <Skeleton variant="card" count={1} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Dividends" description="Income received, and how much of it was reinvested." />
        <ErrorState title="Couldn't load your dividends" message={error} />
      </div>
    )
  }

  const preview = previewSharesAcquired(formValues)

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Dividends"
        description="Income received, and how much of it was reinvested - user-entered, since Athena doesn't source dividend data automatically yet."
        action={addButton}
      />

      {dividends.length === 0 ? (
        <EmptyState
          icon={CircleDollarSign}
          title="No dividends recorded"
          message="Record a dividend payment to track income alongside price-based gain/loss."
          action={addButton}
        />
      ) : (
        <>
          {rowError && (
            <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{rowError}</p>
          )}

          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    <th className="px-5 py-3">Pay Date</th>
                    <th className="px-3 py-3">Company</th>
                    <th className="px-3 py-3">Amount/Share</th>
                    <th className="px-3 py-3">Shares</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Reinvested</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dividends.map((dividend) => (
                    <tr key={dividend._id} className="transition-colors hover:bg-surface-sunken/50">
                      <td className="px-5 py-3 tabular-nums text-ink">{formatDate(dividend.payDate)}</td>
                      <td className="px-3 py-3 font-semibold text-ink">{dividend.ticker}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{formatCurrency(dividend.amountPerShare)}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{dividend.shares}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{formatCurrency(dividend.totalAmount)}</td>
                      <td className="px-3 py-3">
                        {dividend.reinvested ? (
                          <Badge tone="good">{dividend.sharesAcquired?.toFixed(4)} sh @ {formatCurrency(dividend.reinvestmentPrice)}</Badge>
                        ) : (
                          <span className="text-ink-muted">No</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(dividend)}
                          disabled={deletingId === dividend._id}
                          className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Delete ${dividend.ticker} dividend`}
                          title="Delete dividend"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface-raised p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Record Dividend</h3>
              <button type="button" onClick={closeForm} className="rounded-md p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div>
                <label htmlFor="div-ticker" className="mb-1 block text-xs font-medium text-ink-muted">
                  Ticker or company name
                </label>
                <input
                  id="div-ticker"
                  type="text"
                  required
                  value={formValues.ticker}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, ticker: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="div-amount" className="mb-1 block text-xs font-medium text-ink-muted">
                  Amount per share
                </label>
                <input
                  id="div-amount"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formValues.amountPerShare}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, amountPerShare: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="div-shares" className="mb-1 block text-xs font-medium text-ink-muted">
                  Shares held at payment
                </label>
                <input
                  id="div-shares"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formValues.shares}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, shares: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="div-date" className="mb-1 block text-xs font-medium text-ink-muted">
                  Pay date
                </label>
                <input
                  id="div-date"
                  type="date"
                  required
                  max={toDateInputValue(new Date().toISOString())}
                  value={formValues.payDate}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, payDate: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="div-reinvested"
                  type="checkbox"
                  checked={formValues.reinvested}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, reinvested: event.target.checked }))}
                  className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500/30"
                />
                <label htmlFor="div-reinvested" className="text-sm text-ink">
                  Reinvested
                </label>
              </div>
              {formValues.reinvested && (
                <div>
                  <label htmlFor="div-reinvestment-price" className="mb-1 block text-xs font-medium text-ink-muted">
                    Reinvestment price per share
                  </label>
                  <input
                    id="div-reinvestment-price"
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formValues.reinvestmentPrice}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, reinvestmentPrice: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                  />
                  {preview !== null && (
                    <p className="mt-1 text-xs text-ink-muted">≈ {preview.toFixed(4)} shares acquired</p>
                  )}
                </div>
              )}
              {formError && <p className="text-sm text-critical">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formSubmitting ? 'Saving…' : 'Record Dividend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DividendsSection
