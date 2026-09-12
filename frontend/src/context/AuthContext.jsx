import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchCurrentIdentity } from '../lib/api'

const AuthContext = createContext(null)

/**
 * Tracks whether the current browser session is anonymous or a signed-up
 * account. Fetching /api/identity/me transparently mints an anonymous
 * identity for a brand-new visitor via fetchJson's existing ensureIdentity()
 * path - this introduces no new eager-identity-creation behavior, since
 * Sidebar already fires an identity-requiring fetch on every mount today.
 */
function AuthProvider({ children }) {
  const [email, setEmail] = useState(null)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [notificationPreferences, setNotificationPreferences] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCurrentIdentity()
      setEmail(data.email)
      setIsAnonymous(data.isAnonymous)
      setNotificationPreferences(data.notificationPreferences)
    } catch {
      // Non-critical - the UI just stays in its last-known (anonymous-default) state.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <AuthContext.Provider value={{ email, isAnonymous, notificationPreferences, loading, refresh }}>{children}</AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export { AuthProvider, useAuth }
