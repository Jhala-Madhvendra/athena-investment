import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SharedSnapshot from '../SharedSnapshot'
import { fetchJson } from '../../lib/api'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))

const renderShared = (token = 'abc123') =>
  render(
    <MemoryRouter initialEntries={[`/share/${token}`]}>
      <Routes>
        <Route path="/share/:token" element={<SharedSnapshot />} />
      </Routes>
    </MemoryRouter>
  )

afterEach(() => {
  vi.clearAllMocks()
})

describe('SharedSnapshot', () => {
  it('fetches by the token in the URL', async () => {
    fetchJson.mockResolvedValue({ type: 'portfolio', label: null, payload: { holdings: [], summary: null }, createdAt: '2026-01-01T00:00:00.000Z' })

    renderShared('my-token')

    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith('/api/snapshots/shared/my-token', undefined, expect.any(Object)))
  })

  it('renders a portfolio snapshot as a holdings table', async () => {
    fetchJson.mockResolvedValue({
      type: 'portfolio',
      label: 'My Portfolio',
      payload: {
        holdings: [{ ticker: 'AAPL', shares: 10, currentPrice: 200, currentValue: 2000, gainLoss: 500, returnPercent: 33.3, priceUnavailable: false }],
        summary: { totalCurrentValue: 2345, totalCostBasis: 1500, totalGainLoss: 500, totalReturnPercent: 33.3 },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    renderShared()

    expect(await screen.findByText('My Portfolio')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('$2,345.00')).toBeInTheDocument()
  })

  it('renders a dcf snapshot using DCFSummary', async () => {
    fetchJson.mockResolvedValue({
      type: 'dcf',
      label: 'AAPL DCF',
      payload: {
        ticker: 'AAPL',
        pvOfFCFF: 100,
        terminalValue: 200,
        pvOfTerminalValue: 150,
        enterpriseValue: 250,
        netDebt: -10,
        equityValue: 260,
        intrinsicValuePerShare: 195.5,
        currentMarketPrice: 190,
        upsideDownsidePercent: 2.9,
        disclaimer: 'DCF valuation is highly sensitive to assumptions.',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    renderShared()

    expect(await screen.findByText('Intrinsic Value Per Share')).toBeInTheDocument()
    expect(screen.getByText('Market Price Comparison')).toBeInTheDocument()
  })

  it('shows an error state when the link is no longer available', async () => {
    fetchJson.mockRejectedValue(new Error('Snapshot not found, or this link is no longer available.'))

    renderShared()

    expect(await screen.findByText('This link is no longer available')).toBeInTheDocument()
  })

  it('never renders the app sidebar/nav chrome', async () => {
    fetchJson.mockResolvedValue({ type: 'portfolio', label: null, payload: { holdings: [], summary: null }, createdAt: '2026-01-01T00:00:00.000Z' })

    renderShared()

    await waitFor(() => expect(fetchJson).toHaveBeenCalled())
    expect(screen.queryByLabelText('Sidebar')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Primary')).not.toBeInTheDocument()
  })
})
