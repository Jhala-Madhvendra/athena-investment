import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SimulatorPortfolio from '../SimulatorPortfolio'
import { fetchJson } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))
vi.mock('../SimulationAnalyticsSection', () => ({
  default: ({ portfolioId, holdingsCount }) => (
    <div data-testid="analytics-section">analytics:{portfolioId}:{holdingsCount}</div>
  ),
}))
vi.mock('../SimulationScenarioSection', () => ({
  default: ({ portfolioId, holdingsCount }) => (
    <div data-testid="scenario-section">scenario:{portfolioId}:{holdingsCount}</div>
  ),
}))

const detailFixture = (overrides = {}) => ({
  id: 'p1',
  name: 'Aggressive AI bet',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  holdings: [
    {
      ticker: 'NVDA',
      shares: 10,
      averagePurchasePrice: 120,
      currentPrice: 130,
      costBasis: 1200,
      currentValue: 1300,
      gainLoss: 100,
      returnPercent: 8.33,
      assumedPriceDefaulted: false,
      priceUnavailable: false,
    },
  ],
  summary: { totalCurrentValue: 1300, totalCostBasis: 1200, totalGainLoss: 100, totalReturnPercent: 8.33, numberOfHoldings: 1 },
  ...overrides,
})

const renderDetail = (portfolioId = 'p1') =>
  render(
    <MemoryRouter initialEntries={[`/simulator/${portfolioId}`]}>
      <Routes>
        <Route path="/simulator/:portfolioId" element={<SimulatorPortfolio />} />
      </Routes>
    </MemoryRouter>
  )

afterEach(() => {
  vi.clearAllMocks()
})

describe('SimulatorPortfolio', () => {
  it('loads the portfolio and seeds the draft editor from its holdings', async () => {
    fetchJson.mockResolvedValue(detailFixture())

    renderDetail()

    expect(await screen.findByDisplayValue('Aggressive AI bet')).toBeInTheDocument()
    expect(screen.getByDisplayValue('NVDA')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    expect(screen.getByDisplayValue('120')).toBeInTheDocument()
  })

  it('leaves assumedPrice blank when the backend defaulted it to the live price', async () => {
    fetchJson.mockResolvedValue(
      detailFixture({ holdings: [{ ticker: 'NVDA', shares: 10, averagePurchasePrice: 130, assumedPriceDefaulted: true }] })
    )

    renderDetail()

    await screen.findByDisplayValue('NVDA')
    expect(screen.getByLabelText('Holding 1 assumed price')).toHaveValue(null)
  })

  it('disables Save Holdings until the draft is edited', async () => {
    fetchJson.mockResolvedValue(detailFixture())
    const user = userEvent.setup()

    renderDetail()
    await screen.findByDisplayValue('NVDA')

    expect(screen.getByRole('button', { name: /Save Holdings/i })).toBeDisabled()

    await user.clear(screen.getByLabelText('Holding 1 shares'))
    await user.type(screen.getByLabelText('Holding 1 shares'), '15')

    expect(screen.getByRole('button', { name: /Save Holdings/i })).not.toBeDisabled()
  })

  it('adds a new row and saves the whole holdings array via PUT', async () => {
    fetchJson.mockResolvedValue(detailFixture())
    const user = userEvent.setup()

    renderDetail()
    await screen.findByDisplayValue('NVDA')

    await user.click(screen.getByRole('button', { name: /Add Holding/i }))
    await user.type(screen.getByLabelText('Holding 2 ticker or company name'), 'msft')
    await user.type(screen.getByLabelText('Holding 2 shares'), '5')

    await user.click(screen.getByRole('button', { name: /Save Holdings/i }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/simulation/portfolios/p1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Aggressive AI bet',
          holdings: [
            { ticker: 'NVDA', shares: 10, assumedPrice: 120 },
            { ticker: 'MSFT', shares: 5, assumedPrice: null },
          ],
        }),
      })
    )
  })

  it('passes portfolioId and holdingsCount through to the analytics and scenario sections', async () => {
    fetchJson.mockResolvedValue(detailFixture())

    renderDetail()

    expect(await screen.findByTestId('analytics-section')).toHaveTextContent('analytics:p1:1')
    expect(screen.getByTestId('scenario-section')).toHaveTextContent('scenario:p1:1')
  })

  it('shows an error state when loading fails', async () => {
    fetchJson.mockRejectedValue(new Error('Not found.'))

    renderDetail()

    expect(await screen.findByText("Couldn't load this what-if portfolio")).toBeInTheDocument()
  })
})
