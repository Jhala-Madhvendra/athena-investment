import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Simulator from '../Simulator'
import { fetchJson } from '../../lib/api'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))

const renderSimulator = () => render(<MemoryRouter><Simulator /></MemoryRouter>)

afterEach(() => {
  vi.clearAllMocks()
})

describe('Simulator', () => {
  it('shows an empty state when there are no what-if portfolios yet', async () => {
    fetchJson.mockResolvedValue({ portfolios: [] })

    renderSimulator()

    expect(await screen.findByText('No what-if portfolios yet')).toBeInTheDocument()
  })

  it('lists existing what-if portfolios', async () => {
    fetchJson.mockResolvedValue({
      portfolios: [{ _id: 'p1', name: 'Aggressive AI bet', holdings: [{ ticker: 'NVDA' }], createdAt: '2026-01-01T00:00:00.000Z' }],
    })

    renderSimulator()

    expect(await screen.findByText('Aggressive AI bet')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('creates a new what-if portfolio', async () => {
    fetchJson.mockImplementation((path, options = {}) => {
      const method = options.method || 'GET'
      if (method === 'POST') return Promise.resolve({ portfolio: { _id: 'p2', name: 'New idea' } })
      return Promise.resolve({ portfolios: [] })
    })
    const user = userEvent.setup()

    renderSimulator()
    await screen.findByText('No what-if portfolios yet')

    await user.type(screen.getByLabelText('New what-if portfolio name'), 'New idea')
    await user.click(screen.getByRole('button', { name: /New Portfolio/i }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/simulation/portfolios', {
        method: 'POST',
        body: JSON.stringify({ name: 'New idea', holdings: [] }),
      })
    )
  })

  it('deletes a what-if portfolio', async () => {
    fetchJson.mockImplementation((path, options = {}) => {
      const method = options.method || 'GET'
      if (method === 'DELETE') return Promise.resolve({})
      return Promise.resolve({ portfolios: [{ _id: 'p1', name: 'To delete', holdings: [], createdAt: null }] })
    })
    const user = userEvent.setup()

    renderSimulator()
    await screen.findByText('To delete')

    await user.click(screen.getByLabelText('Delete To delete'))

    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith('/api/simulation/portfolios/p1', { method: 'DELETE' }))
  })
})
