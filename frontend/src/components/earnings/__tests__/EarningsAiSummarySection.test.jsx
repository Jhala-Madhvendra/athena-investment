import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EarningsAiSummarySection from '../EarningsAiSummarySection'
import { fetchJson } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))

const SUMMARY = { narrative: 'Revenue grew 12% year over year.', evidenceUsed: ['growth.revenue.variancePercent'] }

const mockSummaryApi = ({ get, post } = {}) => {
  fetchJson.mockReset()
  fetchJson.mockImplementation((path, options = {}) => {
    const method = options.method || 'GET'

    if (path === '/api/earnings/AAPL/summary' && method === 'GET') {
      if (get?.__error) return Promise.reject(new Error(get.message))
      return Promise.resolve(get ?? null)
    }
    if (path === '/api/earnings/AAPL/summary' && method === 'POST') {
      if (post?.__error) return Promise.reject(Object.assign(new Error(post.message), { errors: post.errors }))
      return Promise.resolve(post)
    }
    return Promise.reject(new Error(`mockSummaryApi: no mock registered for ${method} ${path}`))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EarningsAiSummarySection - initial states', () => {
  it('renders nothing while checking for an existing summary', () => {
    fetchJson.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<EarningsAiSummarySection ticker="AAPL" fiscalYearKey="FY2026" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the Generate button when no summary is cached yet', async () => {
    mockSummaryApi({ get: null })
    render(<EarningsAiSummarySection ticker="AAPL" fiscalYearKey="FY2026" />)

    expect(await screen.findByRole('button', { name: 'Generate AI Summary' })).toBeInTheDocument()
  })

  it('renders an existing cached summary with its evidence', async () => {
    mockSummaryApi({ get: SUMMARY })
    render(<EarningsAiSummarySection ticker="AAPL" fiscalYearKey="FY2026" />)

    expect(await screen.findByText('Revenue grew 12% year over year.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument()
  })

  it('re-checks when the fiscal year changes (a newer period was imported)', async () => {
    mockSummaryApi({ get: SUMMARY })
    const { rerender } = render(<EarningsAiSummarySection ticker="AAPL" fiscalYearKey="FY2026" />)
    await screen.findByText('Revenue grew 12% year over year.')

    fetchJson.mockClear()
    mockSummaryApi({ get: null })
    rerender(<EarningsAiSummarySection ticker="AAPL" fiscalYearKey="FY2027" />)

    expect(await screen.findByRole('button', { name: 'Generate AI Summary' })).toBeInTheDocument()
  })
})

describe('EarningsAiSummarySection - generating a summary', () => {
  it('posts regenerate:false and renders the result', async () => {
    mockSummaryApi({ get: null })
    const user = userEvent.setup()
    render(<EarningsAiSummarySection ticker="AAPL" fiscalYearKey="FY2026" />)

    await screen.findByRole('button', { name: 'Generate AI Summary' })
    mockSummaryApi({ get: null, post: SUMMARY })
    await user.click(screen.getByRole('button', { name: 'Generate AI Summary' }))

    expect(await screen.findByText('Revenue grew 12% year over year.')).toBeInTheDocument()
    expect(fetchJson).toHaveBeenCalledWith('/api/earnings/AAPL/summary', {
      method: 'POST',
      body: JSON.stringify({ regenerate: false }),
    })
  })

  it('shows the quota-exceeded message verbatim on a 429', async () => {
    mockSummaryApi({ get: null })
    const user = userEvent.setup()
    render(<EarningsAiSummarySection ticker="AAPL" fiscalYearKey="FY2026" />)

    await screen.findByRole('button', { name: 'Generate AI Summary' })
    mockSummaryApi({
      get: null,
      post: { __error: true, message: "You've reached your free AI report limit for this month (5)." },
    })
    await user.click(screen.getByRole('button', { name: 'Generate AI Summary' }))

    expect(await screen.findByText("You've reached your free AI report limit for this month (5).")).toBeInTheDocument()
  })

  it('posts regenerate:true from the Regenerate button', async () => {
    mockSummaryApi({ get: SUMMARY })
    const user = userEvent.setup()
    render(<EarningsAiSummarySection ticker="AAPL" fiscalYearKey="FY2026" />)

    await screen.findByText('Revenue grew 12% year over year.')
    mockSummaryApi({ get: SUMMARY, post: SUMMARY })
    await user.click(screen.getByRole('button', { name: 'Regenerate' }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/earnings/AAPL/summary', {
        method: 'POST',
        body: JSON.stringify({ regenerate: true }),
      })
    )
  })
})
