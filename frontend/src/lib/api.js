const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const TOKEN_STORAGE_KEY = 'athena_identity_token'

const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY)
const setStoredToken = (token) => localStorage.setItem(TOKEN_STORAGE_KEY, token)

let pendingIdentity = null

/**
 * Returns this browser's identity token, minting one via POST /api/identity
 * on first use. Concurrent callers (e.g. a page firing several parallel
 * fetches on mount before any token exists yet) share one in-flight
 * request instead of each minting their own user - the same
 * request-deduplication shape backend/providers/yahoo/yahooAuth.js already
 * uses for its cookie/crumb cache.
 */
const ensureIdentity = async () => {
  const existing = getStoredToken()
  if (existing) return existing

  if (!pendingIdentity) {
    pendingIdentity = fetch(`${apiBaseUrl}/api/identity`, { method: 'POST' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.message || 'Could not establish identity.')
        }
        setStoredToken(data.token)
        return data.token
      })
      .finally(() => {
        pendingIdentity = null
      })
  }

  return pendingIdentity
}

/**
 * Shared fetch wrapper for the Watchlist/Portfolio pages - attaches the
 * identity bearer token and normalizes errors to the same
 * {message, errors, status} shape every existing page's local fetchJson
 * already uses, so error handling looks identical across old and new pages.
 */
export const fetchJson = async (path, options = {}, signal) => {
  const token = await ensureIdentity()

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal,
  })
  const data = await response.json()

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed.')
    error.errors = data.errors
    error.status = response.status
    throw error
  }

  return data
}

export { apiBaseUrl }
