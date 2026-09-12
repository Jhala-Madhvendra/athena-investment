import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Beaker, Plus, Trash2, ArrowRight } from 'lucide-react'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import EmptyState from './ui/EmptyState'
import SectionHeader from './ui/SectionHeader'
import { fetchJson } from '../lib/api'

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

/**
 * List of a user's paper (what-if) portfolios - create one here, then add
 * holdings and run analytics/scenarios on its own detail page. Entirely
 * hypothetical: Athena does not connect to a brokerage or execute trades,
 * here or anywhere else.
 */
function Simulator() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [portfolios, setPortfolios] = useState([])

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [deletingId, setDeletingId] = useState(null)
  const [rowError, setRowError] = useState('')

  const loadPortfolios = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchJson('/api/simulation/portfolios', undefined, signal)
      setPortfolios(data.portfolios || [])
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError(requestError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadPortfolios(controller.signal)
    return () => controller.abort()
  }, [])

  const handleCreate = async (event) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) {
      setCreateError('Enter a name for this what-if portfolio.')
      return
    }

    setCreating(true)
    setCreateError('')
    try {
      await fetchJson('/api/simulation/portfolios', { method: 'POST', body: JSON.stringify({ name, holdings: [] }) })
      setNewName('')
      await loadPortfolios()
    } catch (requestError) {
      setCreateError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (portfolio) => {
    setDeletingId(portfolio._id)
    setRowError('')
    try {
      await fetchJson(`/api/simulation/portfolios/${portfolio._id}`, { method: 'DELETE' })
      await loadPortfolios()
    } catch (requestError) {
      setRowError(requestError.message)
    } finally {
      setDeletingId(null)
    }
  }

  const createForm = (
    <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={newName}
        onChange={(event) => {
          setNewName(event.target.value)
          setCreateError('')
        }}
        placeholder="e.g. Aggressive AI bet"
        aria-label="New what-if portfolio name"
        className="w-56 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
      />
      <button
        type="submit"
        disabled={creating}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {creating ? 'Creating…' : 'New Portfolio'}
      </button>
    </form>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Simulator" description="Build and stress-test hypothetical, what-if portfolios." />
        <Skeleton variant="card" count={1} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Simulator" description="Build and stress-test hypothetical, what-if portfolios." />
        <ErrorState title="Couldn't load your what-if portfolios" message={error} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Simulator"
        description="Build and stress-test hypothetical, what-if portfolios - separate from what you actually own."
        action={createForm}
      />

      {createError && (
        <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{createError}</p>
      )}
      {rowError && (
        <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{rowError}</p>
      )}

      {portfolios.length === 0 ? (
        <EmptyState
          icon={Beaker}
          title="No what-if portfolios yet"
          message="Create a hypothetical portfolio to test allocations and stress scenarios before (or instead of) committing real money."
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-3 py-3">Holdings</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {portfolios.map((portfolio) => (
                  <tr key={portfolio._id} className="transition-colors hover:bg-surface-sunken/50">
                    <td className="px-5 py-3">
                      <Link to={`/simulator/${portfolio._id}`} className="font-semibold text-ink hover:underline">
                        {portfolio.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-ink">{portfolio.holdings?.length ?? 0}</td>
                    <td className="px-3 py-3 text-ink-muted">{formatDate(portfolio.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/simulator/${portfolio._id}`}
                          className="inline-flex items-center gap-1 rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
                          aria-label={`Open ${portfolio.name}`}
                          title="Open"
                        >
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(portfolio)}
                          disabled={deletingId === portfolio._id}
                          className="rounded-md p-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Delete ${portfolio.name}`}
                          title="Delete"
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
      )}

      <p className="text-xs text-ink-muted">
        This is a hypothetical what-if tool - Athena does not connect to a brokerage, execute trades, or recommend
        buying or selling anything. Not investment advice.
      </p>
    </div>
  )
}

export default Simulator
