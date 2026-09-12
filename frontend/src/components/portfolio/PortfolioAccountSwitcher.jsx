import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { fetchJson } from '../../lib/api'

const NEW_ACCOUNT_VALUE = '__new__'

/**
 * Fetches the caller's portfolio accounts on mount and reports the
 * selected one via onChange - including once on initial load, as soon as
 * the default account's real id is known. Portfolio.jsx never relies on
 * the backend's "omitted portfolioId = aggregate across every account"
 * default for its own fetches; it always waits for this component to
 * report a concrete id first. See the bookkeeping-depth plan's "Scope
 * decision" section.
 */
function PortfolioAccountSwitcher({ onChange }) {
  const [accounts, setAccounts] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const loadAccounts = async (preferId) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchJson('/api/portfolio-accounts')
      const list = data.accounts || []
      setAccounts(list)

      const nextId = preferId || list.find((a) => a.isDefault)?._id || list[0]?._id || ''
      setSelectedId(nextId)
      if (nextId) onChange?.(nextId)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch
  }, [])

  const handleSelectChange = (event) => {
    const value = event.target.value
    if (value === NEW_ACCOUNT_VALUE) {
      setCreating(true)
      return
    }
    setSelectedId(value)
    onChange?.(value)
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return

    try {
      const data = await fetchJson('/api/portfolio-accounts', { method: 'POST', body: JSON.stringify({ name: trimmed }) })
      setCreating(false)
      setNewName('')
      await loadAccounts(data.account._id)
    } catch (requestError) {
      setError(requestError.errors?.join(' ') || requestError.message)
    }
  }

  if (loading) {
    return <div className="h-9 w-48 animate-pulse rounded-lg bg-surface-sunken" aria-hidden="true" />
  }

  if (error) {
    return <p className="text-sm text-critical">{error}</p>
  }

  if (creating) {
    return (
      <form onSubmit={handleCreateSubmit} className="flex items-center gap-2">
        <input
          type="text"
          autoFocus
          required
          placeholder="Account name (e.g. Retirement)"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600">
          Create
        </button>
        <button
          type="button"
          onClick={() => {
            setCreating(false)
            setNewName('')
          }}
          className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-semibold text-ink-secondary hover:bg-surface-sunken"
        >
          Cancel
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Wallet className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <label htmlFor="portfolio-account-select" className="sr-only">
        Portfolio account
      </label>
      <select
        id="portfolio-account-select"
        value={selectedId}
        onChange={handleSelectChange}
        className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
      >
        {accounts.map((account) => (
          <option key={account._id} value={account._id}>
            {account.name}
          </option>
        ))}
        <option value={NEW_ACCOUNT_VALUE}>
          + New Account
        </option>
      </select>
    </div>
  )
}

export default PortfolioAccountSwitcher
