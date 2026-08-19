import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TransactionsSection from '../TransactionsSection'
import { fetchJson } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))

const transactionFixture = (overrides = {}) => ({
  _id: 'txn-1',
  ticker: 'AAPL',
  type: 'BUY',
  quantity: 10,
  price: 150,
  transactionDate: '2025-01-15T00:00:00.000Z',
  ...overrides,
})

/** Routes the mocked fetchJson by (path, method) - mirrors Alerts.test.jsx's mockAlertsApi. */
const mockTransactionsApi = ({ list, add, update, remove, timeline } = {}) => {
  fetchJson.mockReset()
  fetchJson.mockImplementation((path, options = {}) => {
    const method = options.method || 'GET'

    if (path === '/api/portfolio/transactions' && method === 'GET') {
      if (list?.__error) return Promise.reject(new Error(list.message))
      return Promise.resolve(list)
    }
    if (path === '/api/portfolio/transactions' && method === 'POST') {
      if (add?.__error) return Promise.reject(Object.assign(new Error(add.message), { errors: add.errors }))
      return Promise.resolve(add)
    }
    if (path.match(/\/api\/portfolio\/transactions\/[^/]+$/) && method === 'PUT') {
      if (update?.__error) return Promise.reject(new Error(update.message))
      return Promise.resolve(update)
    }
    if (path.match(/\/api\/portfolio\/transactions\/[^/]+$/) && method === 'DELETE') {
      if (remove?.__error) return Promise.reject(new Error(remove.message))
      return Promise.resolve(remove ?? { message: 'Transaction removed.' })
    }
    if (path === '/api/portfolio/holdings/history') {
      if (timeline?.__error) return Promise.reject(new Error(timeline.message))
      return Promise.resolve(timeline)
    }
    return Promise.reject(new Error(`mockTransactionsApi: no mock registered for ${method} ${path}`))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TransactionsSection - loading and empty states', () => {
  it('shows an empty state when there are no transactions', async () => {
    mockTransactionsApi({ list: { transactions: [] } })
    render(<TransactionsSection />)
    expect(await screen.findByText('No transactions recorded')).toBeInTheDocument()
  })

  it('shows an error state when the list request fails', async () => {
    mockTransactionsApi({ list: { __error: true, message: 'Server error.' } })
    render(<TransactionsSection />)
    expect(await screen.findByText("Couldn't load your transactions")).toBeInTheDocument()
  })
})

describe('TransactionsSection - rendering a list', () => {
  it('renders a transaction with its ticker, type, quantity, and price', async () => {
    mockTransactionsApi({ list: { transactions: [transactionFixture()] } })
    render(<TransactionsSection />)

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('BUY')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
  })

  it('labels price and total with the ticker\'s own currency instead of assuming USD', async () => {
    mockTransactionsApi({
      list: { transactions: [transactionFixture({ ticker: 'TCS.BO', quantity: 4, price: 2315, currency: 'INR' })] },
    })
    render(<TransactionsSection />)

    expect(await screen.findByText('TCS.BO')).toBeInTheDocument()
    expect(screen.getByText('2,315.00 INR')).toBeInTheDocument()
    expect(screen.getByText('9,260.00 INR')).toBeInTheDocument()
  })
})

describe('TransactionsSection - recording a transaction', () => {
  it('posts the form and refreshes the list on success', async () => {
    mockTransactionsApi({
      list: { transactions: [] },
      add: { transaction: transactionFixture() },
    })
    const onTransactionsChanged = vi.fn()
    const { container } = render(<TransactionsSection onTransactionsChanged={onTransactionsChanged} />)

    await screen.findByText('No transactions recorded')
    fireEvent.click(screen.getAllByRole('button', { name: 'Record Transaction' })[0])

    fireEvent.change(screen.getByLabelText('Ticker or company name'), { target: { value: 'AAPL' } })
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Execution price per share'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('Transaction date'), { target: { value: '2025-01-15' } })

    mockTransactionsApi({
      list: { transactions: [transactionFixture()] },
      add: { transaction: transactionFixture() },
    })
    fireEvent.submit(container.querySelector('form'))

    await waitFor(() => expect(onTransactionsChanged).toHaveBeenCalled())
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
  })

  it('shows a validation error without closing the form', async () => {
    mockTransactionsApi({
      list: { transactions: [] },
      add: { __error: true, message: 'Transaction validation failed.', errors: ['Quantity must be a positive number.'] },
    })
    const { container } = render(<TransactionsSection />)

    await screen.findByText('No transactions recorded')
    fireEvent.click(screen.getAllByRole('button', { name: 'Record Transaction' })[0])
    fireEvent.change(screen.getByLabelText('Ticker or company name'), { target: { value: 'AAPL' } })
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '-1' } })
    fireEvent.change(screen.getByLabelText('Execution price per share'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('Transaction date'), { target: { value: '2025-01-15' } })
    fireEvent.submit(container.querySelector('form'))

    expect(await screen.findByText('Quantity must be a positive number.')).toBeInTheDocument()
  })
})

describe('TransactionsSection - deleting a transaction', () => {
  it('removes the transaction from the list on success', async () => {
    mockTransactionsApi({ list: { transactions: [transactionFixture()] }, remove: { message: 'Transaction removed.' } })
    render(<TransactionsSection />)

    await screen.findByText('AAPL')
    mockTransactionsApi({ list: { transactions: [] }, remove: { message: 'Transaction removed.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete AAPL transaction' }))

    await waitFor(() => expect(screen.queryByText('AAPL')).not.toBeInTheDocument())
  })

  it('surfaces an InsufficientHoldingsError message inline instead of silently failing', async () => {
    mockTransactionsApi({
      list: { transactions: [transactionFixture()] },
      remove: { __error: true, message: 'This change would leave AAPL at -3 shares on 2025-03-01, which is negative.' },
    })
    render(<TransactionsSection />)

    await screen.findByText('AAPL')
    fireEvent.click(screen.getByRole('button', { name: 'Delete AAPL transaction' }))

    expect(await screen.findByText(/which is negative/)).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument() // not removed from the list
  })
})

describe('TransactionsSection - reconstructed holdings timeline', () => {
  it('lazily loads and displays the timeline when toggled open', async () => {
    mockTransactionsApi({
      list: { transactions: [transactionFixture()] },
      timeline: { hasTransactionHistory: true, timeline: [{ startDate: '2025-01-15', endDate: null, holdings: { AAPL: 10 } }] },
    })
    render(<TransactionsSection />)

    await screen.findByText('AAPL')
    expect(fetchJson).not.toHaveBeenCalledWith('/api/portfolio/holdings/history')

    fireEvent.click(screen.getByRole('button', { name: 'Show reconstructed holdings timeline' }))

    expect(await screen.findByText('AAPL: 10')).toBeInTheDocument()
    expect(screen.getByText('Present')).toBeInTheDocument()
  })
})
