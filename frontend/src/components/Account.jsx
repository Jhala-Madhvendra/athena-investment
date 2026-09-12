import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, UserCircle } from 'lucide-react'
import Card from './ui/Card'
import SectionHeader from './ui/SectionHeader'
import Skeleton from './ui/Skeleton'
import { useAuth } from '../context/AuthContext'
import { signup, login, logout, updateNotificationPreferences } from '../lib/api'

const emptyFormValues = { email: '', password: '' }

const emptyPreferences = { emailEnabled: false, slackWebhookUrl: '', telegramChatId: '', digestEnabled: false }

/**
 * Signed-in state: shows the account's email + a way to log out. Anonymous
 * state: two forms - Create Account (upgrades the CURRENT session in place,
 * so any existing Portfolio/Watchlist/Dividend/Decision data carries over,
 * since it's the same underlying userId - see identity.service.js's
 * signup()) and Log In (switches to a different, already-existing account -
 * the current anonymous session's data stays behind unless it's claimed via
 * Create Account first).
 */
function Account() {
  const navigate = useNavigate()
  const { email, isAnonymous, notificationPreferences, loading, refresh } = useAuth()

  const [signupValues, setSignupValues] = useState(emptyFormValues)
  const [signupError, setSignupError] = useState('')
  const [signupSubmitting, setSignupSubmitting] = useState(false)

  const [loginValues, setLoginValues] = useState(emptyFormValues)
  const [loginError, setLoginError] = useState('')
  const [loginSubmitting, setLoginSubmitting] = useState(false)

  const [loggingOut, setLoggingOut] = useState(false)

  const handleSignup = async (event) => {
    event.preventDefault()
    setSignupSubmitting(true)
    setSignupError('')
    try {
      await signup(signupValues.email, signupValues.password)
      await refresh()
      navigate('/portfolio')
    } catch (requestError) {
      setSignupError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setSignupSubmitting(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoginSubmitting(true)
    setLoginError('')
    try {
      await login(loginValues.email, loginValues.password)
      await refresh()
      navigate('/portfolio')
    } catch (requestError) {
      setLoginError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setLoginSubmitting(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      await refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Account" description="Sign in or create an account." />
        <Skeleton variant="card" count={1} />
      </div>
    )
  }

  if (!isAnonymous) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Account" description="Your Athena account." />
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
              <UserCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{email}</p>
              <p className="text-xs text-ink-muted">Signed in</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {loggingOut ? 'Logging out…' : 'Log Out'}
          </button>
        </Card>

        <NotificationPreferencesCard notificationPreferences={notificationPreferences} onSaved={refresh} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Account" description="You're currently browsing anonymously - create an account to keep your data across devices." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Create Account" eyebrow="Keeps your current data">
          <p className="mb-4 text-xs text-ink-muted">
            This upgrades your current session - any Portfolio holdings, Watchlist entries, or Dividends you've already
            recorded on this device carry over to the new account.
          </p>
          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label htmlFor="signup-email" className="mb-1 block text-xs font-medium text-ink-muted">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={signupValues.email}
                onChange={(event) => setSignupValues((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="mb-1 block text-xs font-medium text-ink-muted">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                required
                minLength={8}
                value={signupValues.password}
                onChange={(event) => setSignupValues((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p>
            </div>
            {signupError && <p className="text-sm text-critical">{signupError}</p>}
            <button
              type="submit"
              disabled={signupSubmitting}
              className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signupSubmitting ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        </Card>

        <Card title="Log In" eyebrow="Switches to a different account">
          <p className="mb-4 text-xs text-ink-muted">
            Logging in switches to an existing account. Your current anonymous session's data stays behind on this
            device unless you claim it with Create Account first.
          </p>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label htmlFor="login-email" className="mb-1 block text-xs font-medium text-ink-muted">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={loginValues.email}
                onChange={(event) => setLoginValues((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1 block text-xs font-medium text-ink-muted">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={loginValues.password}
                onChange={(event) => setLoginValues((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
              />
            </div>
            {loginError && <p className="text-sm text-critical">{loginError}</p>}
            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginSubmitting ? 'Logging in…' : 'Log In'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}

/**
 * Push-delivery opt-ins (backend/notifications/). Only shown for signed-in
 * users - push delivery needs an email at minimum, and email itself needs
 * a separate explicit opt-in on top of just having one. Partial updates
 * only send the fields that changed (lib/api.js's updateNotificationPreferences),
 * so toggling one channel never clobbers another's already-saved value.
 */
function NotificationPreferencesCard({ notificationPreferences, onSaved }) {
  const [values, setValues] = useState(emptyPreferences)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (notificationPreferences) {
      setValues({
        emailEnabled: notificationPreferences.emailEnabled ?? false,
        slackWebhookUrl: notificationPreferences.slackWebhookUrl ?? '',
        telegramChatId: notificationPreferences.telegramChatId ?? '',
        digestEnabled: notificationPreferences.digestEnabled ?? false,
      })
    }
  }, [notificationPreferences])

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateNotificationPreferences({
        emailEnabled: values.emailEnabled,
        slackWebhookUrl: values.slackWebhookUrl.trim() || null,
        telegramChatId: values.telegramChatId.trim() || null,
        digestEnabled: values.digestEnabled,
      })
      setSaved(true)
      await onSaved?.()
    } catch (requestError) {
      setError(requestError.errors?.join(' ') || requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Notifications" eyebrow="Push delivery">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label htmlFor="pref-email" className="text-sm font-medium text-ink">
              Email alerts
            </label>
            <p className="text-xs text-ink-muted">Batched alert notifications sent to your account email.</p>
          </div>
          <input
            id="pref-email"
            type="checkbox"
            checked={values.emailEnabled}
            onChange={(event) => setValues((prev) => ({ ...prev, emailEnabled: event.target.checked }))}
            className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500/30"
          />
        </div>

        <div>
          <label htmlFor="pref-slack" className="mb-1 block text-xs font-medium text-ink-muted">
            Slack webhook URL
          </label>
          <input
            id="pref-slack"
            type="text"
            placeholder="https://hooks.slack.com/services/..."
            value={values.slackWebhookUrl}
            onChange={(event) => setValues((prev) => ({ ...prev, slackWebhookUrl: event.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-muted">Slack → your workspace → Add an App → Incoming Webhooks. Leave blank to disable.</p>
        </div>

        <div>
          <label htmlFor="pref-telegram" className="mb-1 block text-xs font-medium text-ink-muted">
            Telegram chat ID
          </label>
          <input
            id="pref-telegram"
            type="text"
            placeholder="123456789"
            value={values.telegramChatId}
            onChange={(event) => setValues((prev) => ({ ...prev, telegramChatId: event.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-muted">Message the Athena bot on Telegram and it'll reply with your chat ID. Leave blank to disable.</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <label htmlFor="pref-digest" className="text-sm font-medium text-ink">
              Weekly portfolio digest
            </label>
            <p className="text-xs text-ink-muted">An AI-narrated summary of your holdings, sent once a week.</p>
          </div>
          <input
            id="pref-digest"
            type="checkbox"
            checked={values.digestEnabled}
            onChange={(event) => setValues((prev) => ({ ...prev, digestEnabled: event.target.checked }))}
            className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500/30"
          />
        </div>

        {error && <p className="text-sm text-critical">{error}</p>}
        {saved && !error && <p className="text-sm text-good">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </form>
    </Card>
  )
}

export default Account
