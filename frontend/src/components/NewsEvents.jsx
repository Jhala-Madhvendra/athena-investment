import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RefreshCw, Newspaper } from 'lucide-react'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import EmptyState from './ui/EmptyState'
import NewsCard from './news/NewsCard'
import CategoryFilter from './news/CategoryFilter'
import { formatRelativeTime, formatAbsoluteDateTime } from '../lib/newsFormat'

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const ARTICLE_LIMIT = 20

const fetchJson = async (url, options, signal) => {
  const response = await fetch(url, { ...options, signal })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Request failed.')
  }
  return data
}

/**
 * "News & Events" tab - the deterministic news pipeline's only UI surface.
 * Never calls the provider on every render (backend gates that with a
 * cache TTL); the Refresh button is the explicit, rate-limited escape
 * hatch. See research/engineering/NewsCaching.md.
 */
function NewsEvents() {
  const { ticker } = useParams()

  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [provider, setProvider] = useState(null)

  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)

  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  const loadArticles = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: String(ARTICLE_LIMIT) })
      if (activeCategory) params.set('category', activeCategory)

      const data = await fetchJson(
        `${apiBaseUrl}/api/news/${encodeURIComponent(ticker)}?${params.toString()}`,
        undefined,
        signal
      )
      setArticles(data.articles || [])
      setLastRefreshedAt(data.lastRefreshedAt || null)
      setProvider(data.provider || null)
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setArticles([])
        setError(requestError.message)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const loadCategories = async (signal) => {
    try {
      const data = await fetchJson(`${apiBaseUrl}/api/news/${encodeURIComponent(ticker)}/categories`, undefined, signal)
      setCategories(data.categories || [])
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setCategories([])
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = () => loadArticles(controller.signal)
    load()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, activeCategory])

  useEffect(() => {
    const controller = new AbortController()
    const load = () => loadCategories(controller.signal)
    load()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker])

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshError('')
    try {
      await fetchJson(`${apiBaseUrl}/api/news/${encodeURIComponent(ticker)}/refresh`, { method: 'POST' })
      await Promise.all([loadArticles(), loadCategories()])
    } catch (requestError) {
      setRefreshError(requestError.message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">News & Events</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Recent developments for {ticker?.toUpperCase()}, categorized automatically. Each item links to its
            original source - Athena does not reproduce full articles.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {provider === 'mock' && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-ink-secondary">
          Development mode - showing fixture data, not real news (NEWS_PROVIDER=mock).
        </p>
      )}

      {refreshError && (
        <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{refreshError}</p>
      )}

      {categories.length > 0 && (
        <CategoryFilter categories={categories} active={activeCategory} onChange={setActiveCategory} />
      )}

      <Card padded={false}>
        <div className="border-b border-border px-5 py-3 text-xs text-ink-muted">
          {lastRefreshedAt
            ? `Athena last checked for news ${formatRelativeTime(lastRefreshedAt)}`
            : 'Athena has not checked for news yet'}
          {lastRefreshedAt && <span className="ml-1">({formatAbsoluteDateTime(lastRefreshedAt)})</span>}
        </div>

        <div className="p-5">
          {loading && <Skeleton variant="card" count={3} />}

          {!loading && error && (
            <ErrorState title="Couldn't load news" message={error} />
          )}

          {!loading && !error && articles.length === 0 && (
            <EmptyState
              icon={Newspaper}
              title="No news found"
              message={
                activeCategory
                  ? `No ${activeCategory} articles found for ${ticker?.toUpperCase()}. Try a different category or refresh.`
                  : `No recent news found for ${ticker?.toUpperCase()} yet. Try refreshing.`
              }
            />
          )}

          {!loading && !error && articles.length > 0 && (
            <div className="space-y-3">
              {articles.map((article) => (
                <NewsCard key={article._id || article.url} article={article} />
              ))}
            </div>
          )}
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        News is sourced from third parties and categorized automatically by Athena; categorization may occasionally
        be imprecise. Not investment advice.
      </p>
    </div>
  )
}

export default NewsEvents
