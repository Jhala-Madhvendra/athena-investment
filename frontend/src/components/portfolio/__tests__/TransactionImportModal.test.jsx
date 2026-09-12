import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransactionImportModal from '../TransactionImportModal'
import { fetchJson } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))

const csvFile = (text) => new File([text], 'transactions.csv', { type: 'text/csv' })

afterEach(() => {
  vi.clearAllMocks()
})

describe('TransactionImportModal', () => {
  it('does not call fetchJson on mount', () => {
    render(<TransactionImportModal portfolioId="acct-1" onClose={() => {}} onImported={() => {}} />)
    expect(fetchJson).not.toHaveBeenCalled()
  })

  it('parses an uploaded CSV and shows a preview with a ready row', async () => {
    const user = userEvent.setup()
    render(<TransactionImportModal portfolioId="acct-1" onClose={() => {}} onImported={() => {}} />)

    const file = csvFile('Ticker,Type,Quantity,Price,Date\nAAPL,Buy,10,150,2025-01-01')
    const input = document.querySelector('input[type="file"]')
    await user.upload(input, file)

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 row ready to import.')).toBeInTheDocument()
  })

  it('excludes an invalid row from the import count and flags it inline', async () => {
    const user = userEvent.setup()
    render(<TransactionImportModal portfolioId="acct-1" onClose={() => {}} onImported={() => {}} />)

    const file = csvFile('Ticker,Type,Quantity,Price,Date\nAAPL,Buy,10,150,2025-01-01\nMSFT,Bogus,5,300,2025-02-01')
    const input = document.querySelector('input[type="file"]')
    await user.upload(input, file)

    expect(await screen.findByText('1 of 2 rows ready to import.')).toBeInTheDocument()
    expect(screen.getByText('Skipped')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import 1 Transaction' })).toBeInTheDocument()
  })

  it('submits only the valid rows and shows a results summary', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()
    render(<TransactionImportModal portfolioId="acct-1" onClose={() => {}} onImported={onImported} />)

    const file = csvFile('Ticker,Type,Quantity,Price,Date\nAAPL,Buy,10,150,2025-01-01')
    const input = document.querySelector('input[type="file"]')
    await user.upload(input, file)
    await screen.findByText('AAPL')

    fetchJson.mockResolvedValue({ imported: 1, failed: 0, results: [{ success: true, transaction: { _id: 't1' } }] })
    await user.click(screen.getByRole('button', { name: 'Import 1 Transaction' }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/portfolio/transactions/import', {
        method: 'POST',
        body: JSON.stringify({
          transactions: [{ ticker: 'AAPL', type: 'BUY', quantity: 10, price: 150, transactionDate: '2025-01-01' }],
          portfolioId: 'acct-1',
        }),
      })
    )
    expect(await screen.findByText('1 imported')).toBeInTheDocument()
    expect(onImported).toHaveBeenCalled()
  })

  it('shows a per-row failure reason in the results summary without calling onImported when nothing succeeded', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()
    render(<TransactionImportModal portfolioId="acct-1" onClose={() => {}} onImported={onImported} />)

    const file = csvFile('Ticker,Type,Quantity,Price,Date\nZZZZ,Buy,10,150,2025-01-01')
    const input = document.querySelector('input[type="file"]')
    await user.upload(input, file)
    await screen.findByText('ZZZZ')

    fetchJson.mockResolvedValue({ imported: 0, failed: 1, results: [{ success: false, message: 'Company name or ticker could not be resolved.' }] })
    await user.click(screen.getByRole('button', { name: 'Import 1 Transaction' }))

    expect(await screen.findByText(/Company name or ticker could not be resolved/)).toBeInTheDocument()
    expect(onImported).not.toHaveBeenCalled()
  })
})
