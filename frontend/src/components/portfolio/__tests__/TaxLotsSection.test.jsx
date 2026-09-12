import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaxLotsSection from '../TaxLotsSection'
import { fetchJson } from '../../../lib/api'
import * as csvExport from '../../../lib/csvExport'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))
vi.mock('../../../lib/csvExport', () => ({ downloadCsv: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
})

const realizedResponse = {
  realizedLots: [
    {
      ticker: 'AAPL',
      buyDate: '2024-01-01T00:00:00.000Z',
      sellDate: '2025-06-01T00:00:00.000Z',
      quantity: 10,
      buyPrice: 100,
      sellPrice: 150,
      proceeds: 1500,
      costBasis: 1000,
      gainLoss: 500,
      term: 'LONG',
    },
  ],
  summary: { totalRealizedGain: 500, shortTermGain: 0, longTermGain: 500, totalProceeds: 1500, totalCostBasis: 1000 },
}

const openLotsResponse = {
  openLots: [
    { ticker: 'MSFT', buyDate: '2025-01-01T00:00:00.000Z', quantityRemaining: 5, costBasis: 500, currentValue: 600, unrealizedGainLoss: 100 },
  ],
}

describe('TaxLotsSection', () => {
  it('does nothing until a portfolioId is provided', () => {
    render(<TaxLotsSection portfolioId={null} />)
    expect(fetchJson).not.toHaveBeenCalled()
  })

  it('fetches both realized and open lots scoped to the given portfolioId', async () => {
    fetchJson.mockResolvedValueOnce(realizedResponse).mockResolvedValueOnce(openLotsResponse)

    render(<TaxLotsSection portfolioId="acct-1" />)

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/portfolio/tax-lots/realized?portfolioId=acct-1', undefined, expect.any(Object))
    )
    expect(fetchJson).toHaveBeenCalledWith('/api/portfolio/tax-lots/open?portfolioId=acct-1', undefined, expect.any(Object))
  })

  it('renders realized gains grouped with short/long-term subtotals, and open lots', async () => {
    fetchJson.mockResolvedValueOnce(realizedResponse).mockResolvedValueOnce(openLotsResponse)

    render(<TaxLotsSection portfolioId="acct-1" />)

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
    expect(screen.getByText('LONG')).toBeInTheDocument()
  })

  it('shows an empty state when there are no realized gains', async () => {
    fetchJson.mockResolvedValueOnce({ realizedLots: [], summary: {} }).mockResolvedValueOnce({ openLots: [] })

    render(<TaxLotsSection portfolioId="acct-1" />)

    expect(await screen.findByText('No realized gains yet')).toBeInTheDocument()
  })

  it('downloads a CSV of realized gains on click', async () => {
    fetchJson.mockResolvedValueOnce(realizedResponse).mockResolvedValueOnce(openLotsResponse)
    const user = userEvent.setup()

    render(<TaxLotsSection portfolioId="acct-1" />)
    await screen.findByText('AAPL')

    await user.click(screen.getByRole('button', { name: /Download CSV/ }))

    expect(csvExport.downloadCsv).toHaveBeenCalledWith(
      'realized-gains.csv',
      expect.arrayContaining([expect.objectContaining({ Ticker: 'AAPL', Term: 'LONG' })])
    )
  })
})
