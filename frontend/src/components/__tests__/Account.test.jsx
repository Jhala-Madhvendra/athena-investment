import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Account from '../Account'
import { AuthProvider } from '../../context/AuthContext'
import { fetchCurrentIdentity, signup, login, logout, updateNotificationPreferences } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  fetchCurrentIdentity: vi.fn(),
  signup: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))

const renderAccount = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Account />
      </AuthProvider>
    </MemoryRouter>
  )

afterEach(() => {
  vi.clearAllMocks()
})

describe('Account - anonymous state', () => {
  it('shows Create Account and Log In forms', async () => {
    fetchCurrentIdentity.mockResolvedValue({ email: null, isAnonymous: true })
    renderAccount()

    expect(await screen.findByRole('heading', { name: 'Create Account' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Log In' })).toBeInTheDocument()
  })

  it('submits the signup form and shows the new state after refresh', async () => {
    fetchCurrentIdentity.mockResolvedValueOnce({ email: null, isAnonymous: true })
    signup.mockResolvedValue({ userId: 'u1', email: 'test@example.com' })
    const user = userEvent.setup()

    renderAccount()
    await screen.findByRole('heading', { name: 'Create Account' })

    await user.type(screen.getAllByLabelText('Email')[0], 'test@example.com')
    await user.type(screen.getAllByLabelText('Password')[0], 'longenough')

    fetchCurrentIdentity.mockResolvedValueOnce({ email: 'test@example.com', isAnonymous: false })
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => expect(signup).toHaveBeenCalledWith('test@example.com', 'longenough'))
  })

  it('shows a validation error from the backend without closing the form', async () => {
    fetchCurrentIdentity.mockResolvedValue({ email: null, isAnonymous: true })
    signup.mockRejectedValue(Object.assign(new Error('An account with that email already exists.'), { errors: undefined }))
    const user = userEvent.setup()

    renderAccount()
    await screen.findByRole('heading', { name: 'Create Account' })

    await user.type(screen.getAllByLabelText('Email')[0], 'taken@example.com')
    await user.type(screen.getAllByLabelText('Password')[0], 'longenough')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText('An account with that email already exists.')).toBeInTheDocument()
  })

  it('submits the login form and surfaces an invalid-credentials error', async () => {
    fetchCurrentIdentity.mockResolvedValue({ email: null, isAnonymous: true })
    login.mockRejectedValue(new Error('Invalid email or password.'))
    const user = userEvent.setup()

    renderAccount()
    await screen.findByRole('heading', { name: 'Log In' })

    await user.type(screen.getAllByLabelText('Email')[1], 'test@example.com')
    await user.type(screen.getAllByLabelText('Password')[1], 'wrong')
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })
})

describe('Account - signed-in state', () => {
  it('shows the account email and a Log Out button', async () => {
    fetchCurrentIdentity.mockResolvedValue({ email: 'test@example.com', isAnonymous: false })
    renderAccount()

    expect(await screen.findByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument()
  })

  it('logs out and refreshes to the anonymous state', async () => {
    fetchCurrentIdentity.mockResolvedValueOnce({ email: 'test@example.com', isAnonymous: false })
    logout.mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderAccount()
    await screen.findByRole('button', { name: 'Log Out' })

    fetchCurrentIdentity.mockResolvedValueOnce({ email: null, isAnonymous: true })
    await user.click(screen.getByRole('button', { name: 'Log Out' }))

    await waitFor(() => expect(logout).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'Create Account' })).toBeInTheDocument()
  })
})

describe('Account - notification preferences (signed-in only)', () => {
  it('pre-fills the form from the current preferences', async () => {
    fetchCurrentIdentity.mockResolvedValue({
      email: 'test@example.com',
      isAnonymous: false,
      notificationPreferences: { emailEnabled: true, slackWebhookUrl: 'https://hooks.slack.com/services/x', telegramChatId: '123', digestEnabled: false },
    })
    renderAccount()

    expect(await screen.findByLabelText('Email alerts')).toBeChecked()
    expect(screen.getByLabelText('Slack webhook URL')).toHaveValue('https://hooks.slack.com/services/x')
    expect(screen.getByLabelText('Telegram chat ID')).toHaveValue('123')
    expect(screen.getByLabelText('Weekly portfolio digest')).not.toBeChecked()
  })

  it('saves only the changed preferences and shows a confirmation', async () => {
    fetchCurrentIdentity.mockResolvedValue({
      email: 'test@example.com',
      isAnonymous: false,
      notificationPreferences: { emailEnabled: false, slackWebhookUrl: null, telegramChatId: null, digestEnabled: false },
    })
    updateNotificationPreferences.mockResolvedValue({ notificationPreferences: {} })
    const user = userEvent.setup()

    renderAccount()
    await screen.findByLabelText('Email alerts')

    await user.click(screen.getByLabelText('Email alerts'))
    await user.click(screen.getByRole('button', { name: 'Save Preferences' }))

    await waitFor(() =>
      expect(updateNotificationPreferences).toHaveBeenCalledWith({
        emailEnabled: true,
        slackWebhookUrl: null,
        telegramChatId: null,
        digestEnabled: false,
      })
    )
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('shows a validation error from the backend', async () => {
    fetchCurrentIdentity.mockResolvedValue({
      email: 'test@example.com',
      isAnonymous: false,
      notificationPreferences: { emailEnabled: false, slackWebhookUrl: null, telegramChatId: null, digestEnabled: false },
    })
    updateNotificationPreferences.mockRejectedValue(
      Object.assign(new Error('Invalid request.'), { errors: ['slackWebhookUrl must be a valid https://hooks.slack.com/services/... URL, or null to clear it.'] })
    )
    const user = userEvent.setup()

    renderAccount()
    await screen.findByLabelText('Slack webhook URL')

    await user.type(screen.getByLabelText('Slack webhook URL'), 'not-a-url')
    await user.click(screen.getByRole('button', { name: 'Save Preferences' }))

    expect(await screen.findByText(/must be a valid https:\/\/hooks\.slack\.com/)).toBeInTheDocument()
  })

  it('does not render the notifications form in the anonymous state', async () => {
    fetchCurrentIdentity.mockResolvedValue({ email: null, isAnonymous: true })
    renderAccount()

    await screen.findByRole('heading', { name: 'Create Account' })
    expect(screen.queryByLabelText('Email alerts')).not.toBeInTheDocument()
  })
})
