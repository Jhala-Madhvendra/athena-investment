import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DividendsSection from '../DividendsSection'
import { fetchJson } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('DividendsSection', () => {
  it('does nothing until a portfolioId is provided', () => {
    render(<DividendsSection portfolioId={null} />)
    expect(fetchJson).not.toHaveBeenCalled()
  })

  it('fetches dividends scoped to the given portfolioId', async () => {
    fetchJson.mockResolvedValue({ dividends: [] })

    render(<DividendsSection portfolioId="acct-1" />)

    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith('/api/dividends?portfolioId=acct-1', undefined, expect.any(Object)))
  })

  it('renders recorded dividends in a table', async () => {
    fetchJson.mockResolvedValue({
      dividends: [
        {
          _id: 'd1',
          ticker: 'AAPL',
          amountPerShare: 0.5,
          shares: 100,
          totalAmount: 50,
          payDate: '2025-06-01T00:00:00.000Z',
          reinvested: false,
        },
      ],
    })

    render(<DividendsSection portfolioId="acct-1" />)

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()
  })

  it('shows a live shares-acquired preview when reinvested is checked', async () => {
    fetchJson.mockResolvedValue({ dividends: [] })
    const user = userEvent.setup()

    render(<DividendsSection portfolioId="acct-1" />)
    await waitFor(() => expect(fetchJson).toHaveBeenCalled())

    await user.click(screen.getAllByRole('button', { name: 'Record Dividend' })[0])
    await user.type(screen.getByLabelText('Amount per share'), '1')
    await user.type(screen.getByLabelText('Shares held at payment'), '100')
    await user.click(screen.getByLabelText('Reinvested'))
    await user.type(screen.getByLabelText('Reinvestment price per share'), '25')

    expect(await screen.findByText('≈ 4.0000 shares acquired')).toBeInTheDocument()
  })

  it('submits a new dividend scoped to the portfolioId', async () => {
    fetchJson.mockResolvedValueOnce({ dividends: [] })
    const user = userEvent.setup()

    const { container } = render(<DividendsSection portfolioId="acct-1" />)
    await waitFor(() => expect(fetchJson).toHaveBeenCalled())

    await user.click(screen.getAllByRole('button', { name: 'Record Dividend' })[0])
    await user.type(screen.getByLabelText('Ticker or company name'), 'AAPL')
    await user.type(screen.getByLabelText('Amount per share'), '0.5')
    await user.type(screen.getByLabelText('Shares held at payment'), '100')
    await user.type(screen.getByLabelText('Pay date'), '2025-06-01')

    fetchJson.mockResolvedValueOnce({ dividend: { _id: 'd1' } })
    fetchJson.mockResolvedValueOnce({ dividends: [] })

    fireEvent.submit(container.querySelector('form'))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/dividends', {
        method: 'POST',
        body: JSON.stringify({
          ticker: 'AAPL',
          amountPerShare: 0.5,
          shares: 100,
          payDate: '2025-06-01',
          reinvested: false,
          reinvestmentPrice: undefined,
          portfolioId: 'acct-1',
        }),
      })
    )
  })

  it('deletes a dividend', async () => {
    fetchJson.mockResolvedValueOnce({
      dividends: [{ _id: 'd1', ticker: 'AAPL', amountPerShare: 1, shares: 10, totalAmount: 10, payDate: '2025-01-01', reinvested: false }],
    })
    const user = userEvent.setup()

    render(<DividendsSection portfolioId="acct-1" />)
    expect(await screen.findByText('AAPL')).toBeInTheDocument()

    fetchJson.mockResolvedValueOnce({ message: 'Dividend removed.' })
    fetchJson.mockResolvedValueOnce({ dividends: [] })

    await user.click(screen.getByLabelText('Delete AAPL dividend'))

    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith('/api/dividends/d1', { method: 'DELETE' }))
  })
})
