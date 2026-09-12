import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShareSnapshotButton from '../ShareSnapshotButton'
import { fetchJson } from '../../lib/api'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('ShareSnapshotButton', () => {
  it('does not call fetchJson on mount', () => {
    render(<ShareSnapshotButton type="portfolio" label="My Portfolio" buildPayload={() => ({})} />)
    expect(fetchJson).not.toHaveBeenCalled()
  })

  it('creates a snapshot on click and shows the resulting link', async () => {
    fetchJson.mockResolvedValue({ token: 'raw-token-value' })
    const buildPayload = vi.fn(() => ({ holdings: [], summary: {} }))
    const user = userEvent.setup()

    render(<ShareSnapshotButton type="portfolio" label="My Portfolio" buildPayload={buildPayload} />)
    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(buildPayload).toHaveBeenCalledTimes(1)
    expect(fetchJson).toHaveBeenCalledWith('/api/snapshots', {
      method: 'POST',
      body: JSON.stringify({ type: 'portfolio', label: 'My Portfolio', payload: { holdings: [], summary: {} } }),
    })

    await waitFor(() => expect(screen.getByLabelText('Share link')).toHaveValue(`${window.location.origin}/share/raw-token-value`))
  })

  it('shows an error message when the request fails', async () => {
    fetchJson.mockRejectedValue(new Error('Snapshot failed validation.'))
    const user = userEvent.setup()

    render(<ShareSnapshotButton type="dcf" label="AAPL DCF" buildPayload={() => ({})} />)
    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByText('Snapshot failed validation.')).toBeInTheDocument()
  })
})
