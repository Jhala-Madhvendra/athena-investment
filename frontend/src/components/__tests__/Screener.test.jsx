import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Screener from '../Screener'
import { fetchJson } from '../../lib/api'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))

const resultFixture = (overrides = {}) => ({
  criteria: { sortBy: 'healthScore', sortDirection: 'desc' },
  universeMatchedCount: 2,
  scoredCount: 2,
  cappedNote: null,
  companies: [
    {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketCap: 3_000_000_000_000,
      currency: 'USD',
      healthScore: { overall: 88, label: 'Excellent', riskLevel: 'low' },
      ratios: {},
      dataAvailable: true,
      unavailableReason: null,
    },
    {
      ticker: 'BADCO',
      name: 'Bad Co',
      sector: 'Technology',
      industry: 'Hardware',
      marketCap: 1_000_000_000,
      currency: 'USD',
      healthScore: null,
      ratios: null,
      dataAvailable: false,
      unavailableReason: 'No financial data.',
    },
  ],
  disclaimer: 'This is a sorted list based on Athena\'s Health Score and financial ratios, not investment advice.',
  ...overrides,
})

const facetsFixture = { sectors: ['Consumer Cyclical', 'Technology'], industries: ['Consumer Electronics', 'Hardware'] }

const mockScreenerApi = ({ facets = facetsFixture, result = resultFixture(), resultError } = {}) => {
  fetchJson.mockReset()
  fetchJson.mockImplementation((path) => {
    if (path === '/api/screener/facets') return Promise.resolve(facets)
    if (path.startsWith('/api/screener')) {
      return resultError ? Promise.reject(resultError) : Promise.resolve(result)
    }
    return Promise.reject(new Error(`mockScreenerApi: no mock registered for ${path}`))
  })
}

const renderScreener = () => render(<MemoryRouter><Screener /></MemoryRouter>)

afterEach(() => {
  vi.clearAllMocks()
})

describe('Screener', () => {
  it('loads results on mount with no filters', async () => {
    mockScreenerApi()

    renderScreener()

    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument())
    expect(fetchJson).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/screener\?/),
      undefined,
      expect.any(Object)
    )
  })

  it('populates the Sector/Industry dropdowns from /api/screener/facets', async () => {
    mockScreenerApi()

    renderScreener()

    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument())
    expect(screen.getByRole('option', { name: 'Technology' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Consumer Electronics' })).toBeInTheDocument()
  })

  it('shows an unavailable badge instead of a health score when dataAvailable is false', async () => {
    mockScreenerApi()

    renderScreener()

    await waitFor(() => expect(screen.getByText('BADCO')).toBeInTheDocument())
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('applies filters as query params when the form is submitted', async () => {
    mockScreenerApi()
    const user = userEvent.setup()

    renderScreener()
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Sector'), 'Technology')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('sector=Technology'),
        undefined,
        expect.any(Object)
      )
    )
  })

  it('renders the disclaimer and never uses recommendation language', async () => {
    mockScreenerApi()

    renderScreener()

    await waitFor(() => expect(screen.getByText(/not investment advice/i)).toBeInTheDocument())
    expect(screen.queryByText(/top pick/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recommended/i)).not.toBeInTheDocument()
  })

  it('shows an error state when the request fails', async () => {
    mockScreenerApi({ resultError: new Error('Server exploded.') })

    renderScreener()

    await waitFor(() => expect(screen.getByText("Couldn't load the screener")).toBeInTheDocument())
  })
})
