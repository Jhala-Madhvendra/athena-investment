import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AIResearch from '../AIResearch'
import { fetchJson } from '../../lib/api'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))

const renderForTicker = (ticker = 'AAPL') =>
  render(
    <MemoryRouter initialEntries={[`/financials/${ticker}/ai-research`]}>
      <Routes>
        <Route path="/financials/:ticker/ai-research" element={<AIResearch />} />
      </Routes>
    </MemoryRouter>
  )

const REPORT = {
  report: {
    executiveSummary: 'Solid quarter.',
    companyOverview: 'Overview.',
    businessPerformance: 'Performance.',
    financialHealth: 'Health.',
    marketPerformance: 'Market.',
    valuation: 'Valuation.',
    conclusion: 'Conclusion.',
    strengths: ['Strong margins'],
    risks: ['Competition'],
    considerations: ['Peer set is auto-selected'],
    dataGaps: [],
  },
  sectionEvidence: {},
  dataFreshness: {},
  generatedAt: '2026-08-01T00:00:00.000Z',
}

/** Routes the mocked fetchJson by (path, method). */
const mockAiApi = ({ report, usage, generate } = {}) => {
  fetchJson.mockReset()
  fetchJson.mockImplementation((path, options = {}) => {
    const method = options.method || 'GET'

    if (path === '/api/ai/usage') {
      if (usage?.__error) return Promise.reject(new Error(usage.message))
      return Promise.resolve(usage ?? { used: 0, limit: 5, remaining: 5, periodKey: '2026-08' })
    }
    if (path === '/api/ai/AAPL/research-report' && method === 'GET') {
      if (report?.__notFound) return Promise.reject(Object.assign(new Error('Not found'), { status: 404 }))
      if (report?.__error) return Promise.reject(new Error(report.message))
      return Promise.resolve(report)
    }
    if (path === '/api/ai/AAPL/research-report' && method === 'POST') {
      if (generate?.__error) return Promise.reject(Object.assign(new Error(generate.message), { errors: generate.errors }))
      return Promise.resolve(generate)
    }
    return Promise.reject(new Error(`mockAiApi: no mock registered for ${method} ${path}`))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AIResearch - initial states', () => {
  it('shows the Generate button when no report exists yet', async () => {
    mockAiApi({ report: { __notFound: true } })
    renderForTicker()

    expect(await screen.findByText('No research report yet for AAPL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate Research Report' })).toBeInTheDocument()
  })

  it('renders an existing report', async () => {
    mockAiApi({ report: REPORT })
    renderForTicker()

    expect(await screen.findByText('Solid quarter.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument()
  })

  it('shows an error state for a non-404 failure', async () => {
    mockAiApi({ report: { __error: true, message: 'Server error.' } })
    renderForTicker()

    expect(await screen.findByText("Couldn't check for an existing report")).toBeInTheDocument()
  })

  it('shows the shared monthly usage badge', async () => {
    mockAiApi({ report: { __notFound: true }, usage: { used: 3, limit: 5, remaining: 2, periodKey: '2026-08' } })
    renderForTicker()

    expect(await screen.findByText('3 of 5 AI reports used this month.')).toBeInTheDocument()
  })

  it('does not break when the usage lookup fails', async () => {
    mockAiApi({ report: { __notFound: true }, usage: { __error: true, message: 'boom' } })
    renderForTicker()

    expect(await screen.findByText('No research report yet for AAPL')).toBeInTheDocument()
    expect(screen.queryByText(/AI reports used this month/)).not.toBeInTheDocument()
  })
})

describe('AIResearch - generating a report', () => {
  it('posts regenerate:false on the first Generate click and renders the result', async () => {
    mockAiApi({ report: { __notFound: true } })
    const user = userEvent.setup()
    renderForTicker()

    await screen.findByText('No research report yet for AAPL')

    mockAiApi({ report: { __notFound: true }, generate: REPORT })
    await user.click(screen.getByRole('button', { name: 'Generate Research Report' }))

    expect(await screen.findByText('Solid quarter.')).toBeInTheDocument()
    expect(fetchJson).toHaveBeenCalledWith('/api/ai/AAPL/research-report', {
      method: 'POST',
      body: JSON.stringify({ regenerate: false }),
    })
  })

  it('shows the quota-exceeded message verbatim on a 429', async () => {
    mockAiApi({ report: { __notFound: true } })
    const user = userEvent.setup()
    renderForTicker()

    await screen.findByText('No research report yet for AAPL')

    mockAiApi({
      report: { __notFound: true },
      generate: { __error: true, message: "You've reached your free AI report limit for this month (5)." },
    })
    await user.click(screen.getByRole('button', { name: 'Generate Research Report' }))

    expect(await screen.findByText("You've reached your free AI report limit for this month (5).")).toBeInTheDocument()
  })

  it('posts regenerate:true from the Regenerate button and refreshes usage afterward', async () => {
    mockAiApi({ report: REPORT, usage: { used: 1, limit: 5, remaining: 4, periodKey: '2026-08' } })
    const user = userEvent.setup()
    renderForTicker()

    await screen.findByText('Solid quarter.')

    mockAiApi({ report: REPORT, generate: REPORT, usage: { used: 2, limit: 5, remaining: 3, periodKey: '2026-08' } })
    await user.click(screen.getByRole('button', { name: 'Regenerate' }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/ai/AAPL/research-report', {
        method: 'POST',
        body: JSON.stringify({ regenerate: true }),
      })
    )
    expect(await screen.findByText('2 of 5 AI reports used this month.')).toBeInTheDocument()
  })
})
