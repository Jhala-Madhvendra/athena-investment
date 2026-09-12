import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PortfolioDigestCard from '../PortfolioDigestCard'
import { fetchJson } from '../../lib/api'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))

const renderCard = () =>
  render(
    <MemoryRouter>
      <PortfolioDigestCard />
    </MemoryRouter>
  )

afterEach(() => {
  vi.clearAllMocks()
})

describe('PortfolioDigestCard', () => {
  it('never triggers generation - only reads the persisted digest', async () => {
    fetchJson.mockResolvedValue(null)
    renderCard()

    expect(await screen.findByText(/No weekly digest yet/)).toBeInTheDocument()
    expect(fetchJson).toHaveBeenCalledWith('/api/ai/digest', undefined, expect.any(Object))
  })

  it('links to Account settings when no digest exists yet', async () => {
    fetchJson.mockResolvedValue(null)
    renderCard()

    const link = await screen.findByRole('link', { name: 'Account settings' })
    expect(link).toHaveAttribute('href', '/account')
  })

  it('renders the narrative and holding highlights of an existing digest', async () => {
    fetchJson.mockResolvedValue({
      narrative: 'Your portfolio was up 3% this week.',
      holdingHighlights: [{ ticker: 'AAPL', note: 'Reported strong earnings.' }],
      generatedAt: '2026-08-30T00:00:00.000Z',
    })
    renderCard()

    expect(await screen.findByText('Your portfolio was up 3% this week.')).toBeInTheDocument()
    expect(screen.getByText('AAPL:')).toBeInTheDocument()
    expect(screen.getByText('Reported strong earnings.')).toBeInTheDocument()
  })

  it('degrades to the "no digest" state on a fetch error rather than throwing', async () => {
    fetchJson.mockRejectedValue(new Error('boom'))
    renderCard()

    expect(await screen.findByText(/No weekly digest yet/)).toBeInTheDocument()
  })
})
