import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Alerts from '../Alerts'
import { fetchJson } from '../../lib/api'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))

const renderAlerts = (path = '/alerts') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Alerts />
    </MemoryRouter>
  )

const alertFixture = (overrides = {}) => ({
  _id: 'alert-1',
  ticker: 'AAPL',
  type: 'MARKET',
  rule: 'PRICE_DROP_5D',
  severity: 'MEDIUM',
  title: 'Significant price decline over 5 sessions',
  message: 'AAPL declined 8.4% over the last 5 trading sessions.',
  whyItMatters: 'A sustained multi-day decline can reflect deteriorating sentiment.',
  previousValue: 185,
  currentValue: 169.5,
  percentChange: -8.4,
  evidencePeriod: '5 trading sessions ending 2026-08-14',
  source: 'Market price history',
  triggeredAt: new Date().toISOString(),
  isRead: false,
  isDismissed: false,
  ...overrides,
})

/** Routes the mocked fetchJson by (path, options) - mirrors the shape of the other tab's mockXFetch helpers in test/fetchMock.js, adapted for the identity-aware fetchJson wrapper instead of raw global.fetch. */
const mockAlertsApi = ({ list, unreadCount = { count: 0 }, monitor, read, dismiss } = {}) => {
  // mockReset (not just a new mockImplementation) so a previous test's call
  // history doesn't leak in - fetchJson is one shared mock function across
  // every test in this file (from the module-level vi.mock factory), unlike
  // test/fetchMock.js's pattern of reassigning global.fetch to a fresh
  // vi.fn() per test.
  fetchJson.mockReset()
  fetchJson.mockImplementation((path, options = {}) => {
    const method = options.method || 'GET'
    if (path.startsWith('/api/alerts/unread-count')) return Promise.resolve(unreadCount)
    if (path === '/api/alerts/monitor' && method === 'POST') {
      if (monitor?.__error) return Promise.reject(new Error(monitor.message))
      return Promise.resolve(monitor)
    }
    if (path.match(/\/api\/alerts\/[^/]+\/read$/)) return Promise.resolve(read ?? { alert: {} })
    if (path.match(/\/api\/alerts\/[^/]+\/dismiss$/)) return Promise.resolve(dismiss ?? { alert: {} })
    if (path.startsWith('/api/alerts?')) {
      if (list?.__error) return Promise.reject(new Error(list.message))
      return Promise.resolve(list)
    }
    return Promise.reject(new Error(`mockAlertsApi: no mock registered for ${method} ${path}`))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Alerts - loading and empty states', () => {
  it('shows the page header and a skeleton before data arrives', () => {
    mockAlertsApi({ list: new Promise(() => {}) })
    renderAlerts()
    expect(screen.getByText('Alerts')).toBeInTheDocument()
  })

  it('shows an empty state when there are no alerts', async () => {
    mockAlertsApi({ list: { alerts: [], total: 0, page: 1, limit: 20 } })
    renderAlerts()
    expect(await screen.findByText('No alerts')).toBeInTheDocument()
  })
})

describe('Alerts - rendering a list', () => {
  it('renders an alert with its ticker, type, severity, and message', async () => {
    mockAlertsApi({ list: { alerts: [alertFixture()], total: 1, page: 1, limit: 20 } })
    renderAlerts()

    expect(await screen.findByText('Significant price decline over 5 sessions')).toBeInTheDocument()
    expect(screen.getByText('AAPL declined 8.4% over the last 5 trading sessions.')).toBeInTheDocument()
    expect(screen.getByText('MEDIUM')).toBeInTheDocument()
  })

  it('shows an error state when the list request fails', async () => {
    mockAlertsApi({ list: { __error: true, message: 'Server error.' } })
    renderAlerts()
    expect(await screen.findByText("Couldn't load alerts")).toBeInTheDocument()
  })
})

describe('Alerts - filters', () => {
  it('re-fetches with a type filter when a filter chip is clicked', async () => {
    mockAlertsApi({ list: { alerts: [], total: 0, page: 1, limit: 20 } })
    renderAlerts()

    await screen.findByText('No alerts')
    fireEvent.click(screen.getByRole('button', { name: 'Market' }))

    await waitFor(() => {
      const call = fetchJson.mock.calls.find(([path]) => path.includes('type=MARKET'))
      expect(call).toBeTruthy()
    })
  })

  it('pre-filters to a ticker given in the URL and shows a clearable chip', async () => {
    mockAlertsApi({ list: { alerts: [alertFixture()], total: 1, page: 1, limit: 20 } })
    renderAlerts('/alerts?ticker=AAPL')

    await screen.findByText('Significant price decline over 5 sessions')
    expect(screen.getByText('Filtered to AAPL')).toBeInTheDocument()
    const call = fetchJson.mock.calls.find(([path]) => path.startsWith('/api/alerts?'))
    expect(call[0]).toContain('ticker=AAPL')
  })
})

describe('Alerts - monitoring', () => {
  it('shows a result message after checking for new alerts', async () => {
    mockAlertsApi({
      list: { alerts: [], total: 0, page: 1, limit: 20 },
      monitor: { tickersMonitored: ['AAPL', 'MSFT'], alertsCreated: 2, alerts: [], generatedAt: new Date().toISOString() },
    })
    renderAlerts()

    await screen.findByText('No alerts')
    fireEvent.click(screen.getByRole('button', { name: /Check for New Alerts/ }))

    expect(await screen.findByText(/Found 2 new alerts across 2 tracked tickers/)).toBeInTheDocument()
  })

  it('shows an inline error when monitoring fails (e.g. rate-limited)', async () => {
    mockAlertsApi({
      list: { alerts: [], total: 0, page: 1, limit: 20 },
      monitor: { __error: true, message: 'Too many monitoring requests.' },
    })
    renderAlerts()

    await screen.findByText('No alerts')
    fireEvent.click(screen.getByRole('button', { name: /Check for New Alerts/ }))

    expect(await screen.findByText('Too many monitoring requests.')).toBeInTheDocument()
  })
})

describe('Alerts - dismiss', () => {
  it('removes a dismissed alert from the list', async () => {
    mockAlertsApi({ list: { alerts: [alertFixture()], total: 1, page: 1, limit: 20 }, dismiss: { alert: { _id: 'alert-1', isDismissed: true } } })
    renderAlerts()

    await screen.findByText('Significant price decline over 5 sessions')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss alert' }))

    await waitFor(() => {
      expect(screen.queryByText('Significant price decline over 5 sessions')).not.toBeInTheDocument()
    })
  })
})
