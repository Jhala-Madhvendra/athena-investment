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

const parseJsonResponse = async (response) => {
  const data = await response.json()

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed.')
    error.errors = data.errors
    error.status = response.status
    throw error
  }

  return data
}

/**
 * Creates or upgrades an account. Sends the currently-stored token (if any)
 * as `Authorization` so the backend can upgrade an anonymous session in
 * place instead of starting from nothing - see identity.service.js's
 * signup(). If the response carries a fresh `token` (a brand-new account,
 * no prior session to upgrade), it's stored; otherwise the existing stored
 * token is now attached to a real account and needs no change.
 */
export const signup = async (email, password) => {
  const existingToken = getStoredToken()

  const response = await fetch(`${apiBaseUrl}/api/identity/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(existingToken ? { Authorization: `Bearer ${existingToken}` } : {}),
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await parseJsonResponse(response)

  if (data.token) setStoredToken(data.token)
  return data
}

/** Always stores the returned token, replacing whatever was there - matches the backend's single-active-session-per-account model (logging in retires any other device's token). */
export const login = async (email, password) => {
  const response = await fetch(`${apiBaseUrl}/api/identity/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await parseJsonResponse(response)

  setStoredToken(data.token)
  return data
}

/** Invalidates the current token server-side, then clears local storage and the in-flight-mint dedup cache so the very next fetchJson call transparently mints a fresh anonymous identity. */
export const logout = async () => {
  await fetchJson('/api/identity/logout', { method: 'POST' })
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  pendingIdentity = null
}

export const fetchCurrentIdentity = () => fetchJson('/api/identity/me')

/** Partial update - only send the fields that changed, so e.g. toggling emailEnabled never clobbers an already-saved Slack webhook URL. */
export const updateNotificationPreferences = (updates) =>
  fetchJson('/api/identity/notification-preferences', { method: 'PUT', body: JSON.stringify(updates) })

export { apiBaseUrl }
