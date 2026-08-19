import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, History } from 'lucide-react'
import Card from '../ui/Card'
import Skeleton from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'
import SectionHeader from '../ui/SectionHeader'
import Badge from '../ui/Badge'
import { fetchJson } from '../../lib/api'

const formatCurrency = (value, currency) => {
  if (typeof value !== 'number') return '—'
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${formatted} ${currency}` : `$${formatted}`
}

const formatDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '—')

const toDateInputValue = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

const emptyFormValues = { ticker: '', type: 'BUY', quantity: '', price: '', transactionDate: '' }

const formatHoldings = (holdings) => {
  const entries = Object.entries(holdings || {})
  if (entries.length === 0) return 'No open positions'
  return entries.map(([ticker, quantity]) => `${ticker}: ${quantity}`).join(', ')
}

/**
 * The Transaction ledger (Sprint 15) - a BUY/SELL history that's additive
 * and independent from the Holdings list above it (see
 * PortfolioCalculationAssumptions.md's "Transaction-aware historical
 * reconstruction" section): adding/editing a Holding never touches this,
 * and vice versa. Recording transactions here is what lets Portfolio
 * Analytics below switch from an estimate to a true reconstruction -
 * `onTransactionsChanged` tells the parent page to re-fetch analytics after
 * any write, since the server-side cache key already accounts for it.
 */
function TransactionsSection({ onTransactionsChanged }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [transactions, setTransactions] = useState([])

  const [timelineOpen, setTimelineOpen] = useState(false)
  const [timeline, setTimeline] = useState(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [formValues, setFormValues] = useState(emptyFormValues)
  const [formError, setFormError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  const [deletingId, setDeletingId] = useState(null)
  const [rowError, setRowError] = useState('')

  const loadTransactions = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchJson('/api/portfolio/transactions', undefined, signal)
      setTransactions(data.transactions)
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError(requestError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch, same pattern as Portfolio.jsx's loadPortfolio effect (loading state must start true before the request resolves)
    loadTransactions(controller.signal)
    return () => controller.abort()
  }, [])

  const loadTimeline = async () => {
    setTimelineLoading(true)
    setTimelineError('')
    try {
      const data = await fetchJson('/api/portfolio/holdings/history')
      setTimeline(data)
    } catch (requestError) {
      setTimelineError(requestError.message)
    } finally {
      setTimelineLoading(false)
    }
  }

  const toggleTimeline = () => {
    const opening = !timelineOpen
    setTimelineOpen(opening)
    if (opening && !timeline) loadTimeline()
  }

  const openAddForm = () => {
    setEditingTransaction(null)
    setFormValues(emptyFormValues)
    setFormError('')
    setFormOpen(true)
  }

  const openEditForm = (transaction) => {
    setEditingTransaction(transaction)
    setFormValues({
      ticker: transaction.ticker,
      type: transaction.type,
      quantity: String(transaction.quantity),
      price: String(transaction.price),
      transactionDate: toDateInputValue(transaction.transactionDate),
    })
    setFormError('')
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingTransaction(null)
  }

  const refreshAfterChange = async () => {
    await loadTransactions()
    setTimeline(null) // stale after any write - refetched lazily the next time the timeline is opened
    if (timelineOpen) loadTimeline()
    onTransactionsChanged?.()
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    setFormSubmitting(true)
    setFormError('')

    const body = {
      type: formValues.type,
      quantity: Number(formValues.quantity),
      price: Number(formValues.price),
      transactionDate: formValues.transactionDate,
    }

    try {
      if (editingTransaction) {
        await fetchJson(`/api/portfolio/transactions/${editingTransaction._id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await fetchJson('/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({ ...body, ticker: formValues.ticker }),
        })
      }
      closeForm()
      await refreshAfterChange()
    } catch (requestError) {
      setFormError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = async (transaction) => {
    setDeletingId(transaction._id)
    setRowError('')
    try {
      await fetchJson(`/api/portfolio/transactions/${transaction._id}`, { method: 'DELETE' })
      await refreshAfterChange()
    } catch (requestError) {
      // e.g. deleting a BUY that a later SELL depends on (422 InsufficientHoldingsError) - surfaced verbatim, not swallowed.
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
      Record Transaction
    </button>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Transaction History" description="Buys and sells that let Athena reconstruct what you actually held, and when." />
        <Skeleton variant="card" count={1} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Transaction History" description="Buys and sells that let Athena reconstruct what you actually held, and when." />
        <ErrorState title="Couldn't load your transactions" message={error} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Transaction History"
        description="Buys and sells that let Athena reconstruct what you actually held, and when - independent of the Holdings list above."
        action={addButton}
      />

      {transactions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No transactions recorded"
          message="Record your buys and sells to unlock transaction-aware historical analytics below, instead of an estimate based on today's mix. Holdings above are unaffected either way."
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
                    <th className="px-5 py-3">Date</th>
                    <th className="px-3 py-3">Company</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Quantity</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((transaction) => (
                    <tr key={transaction._id} className="transition-colors hover:bg-surface-sunken/50">
                      <td className="px-5 py-3 tabular-nums text-ink">{formatDate(transaction.transactionDate)}</td>
                      <td className="px-3 py-3 font-semibold text-ink">{transaction.ticker}</td>
                      <td className="px-3 py-3">
                        <Badge tone={transaction.type === 'BUY' ? 'good' : 'critical'}>{transaction.type}</Badge>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink">{transaction.quantity}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{formatCurrency(transaction.price, transaction.currency)}</td>
                      <td className="px-3 py-3 tabular-nums text-ink">
                        {formatCurrency(transaction.quantity * transaction.price, transaction.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(transaction)}
                            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
                            aria-label={`Edit ${transaction.ticker} transaction`}
                            title="Edit transaction"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(transaction)}
                            disabled={deletingId === transaction._id}
                            className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Delete ${transaction.ticker} transaction`}
                            title="Delete transaction"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div>
            <button
              type="button"
              onClick={toggleTimeline}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              {timelineOpen ? 'Hide reconstructed holdings timeline' : 'Show reconstructed holdings timeline'}
            </button>

            {timelineOpen && (
              <div className="mt-3">
                {timelineLoading && <Skeleton variant="card" count={1} />}
                {!timelineLoading && timelineError && <ErrorState title="Couldn't load the holdings timeline" message={timelineError} />}
                {!timelineLoading && !timelineError && timeline && (
                  <Card padded={false}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                            <th className="px-5 py-3">From</th>
                            <th className="px-3 py-3">To</th>
                            <th className="px-3 py-3">Holdings</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {timeline.timeline.map((interval) => (
                            <tr key={interval.startDate}>
                              <td className="px-5 py-3 tabular-nums text-ink">{interval.startDate}</td>
                              <td className="px-3 py-3 tabular-nums text-ink">{interval.endDate ?? 'Present'}</td>
                              <td className="px-3 py-3 text-ink-secondary">{formatHoldings(interval.holdings)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface-raised p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">{editingTransaction ? 'Edit Transaction' : 'Record Transaction'}</h3>
              <button type="button" onClick={closeForm} className="rounded-md p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-3">
              {!editingTransaction && (
                <div>
                  <label htmlFor="txn-ticker" className="mb-1 block text-xs font-medium text-ink-muted">
                    Ticker or company name
                  </label>
                  <input
                    id="txn-ticker"
                    type="text"
                    required
                    value={formValues.ticker}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, ticker: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label htmlFor="txn-type" className="mb-1 block text-xs font-medium text-ink-muted">
                  Type
                </label>
                <select
                  id="txn-type"
                  value={formValues.type}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, type: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                >
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
              </div>
              <div>
                <label htmlFor="txn-quantity" className="mb-1 block text-xs font-medium text-ink-muted">
                  Quantity
                </label>
                <input
                  id="txn-quantity"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formValues.quantity}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, quantity: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="txn-price" className="mb-1 block text-xs font-medium text-ink-muted">
                  Execution price per share
                </label>
                <input
                  id="txn-price"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formValues.price}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, price: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
                <p className="mt-1 text-xs text-ink-muted">Enter this in the ticker's own trading currency (e.g. INR for an NSE/BSE listing, USD for a US listing) - Athena labels it for you once saved.</p>
              </div>
              <div>
                <label htmlFor="txn-date" className="mb-1 block text-xs font-medium text-ink-muted">
                  Transaction date
                </label>
                <input
                  id="txn-date"
                  type="date"
                  required
                  max={toDateInputValue(new Date().toISOString())}
                  value={formValues.transactionDate}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, transactionDate: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
                />
              </div>
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
                  {formSubmitting ? 'Saving…' : editingTransaction ? 'Save Changes' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionsSection
