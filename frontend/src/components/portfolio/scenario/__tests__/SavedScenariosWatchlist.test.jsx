import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavedScenariosWatchlist from '../SavedScenariosWatchlist'
import { fetchJson } from '../../../../lib/api'

vi.mock('../../../../lib/api', () => ({ fetchJson: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('SavedScenariosWatchlist', () => {
  it('renders nothing while loading or when there are no saved scenarios', async () => {
    fetchJson.mockResolvedValue({ savedScenarios: [] })
    const { container } = render(<SavedScenariosWatchlist refreshKey={0} />)

    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('lists a saved scenario with its last check result and threshold', async () => {
    fetchJson.mockResolvedValue({
      savedScenarios: [
        { _id: 's1', name: 'Bear Case', alertThresholdPercent: -15, lastPercentageChange: -8.2, lastCheckedAt: '2026-08-30T12:00:00.000Z' },
      ],
    })

    render(<SavedScenariosWatchlist refreshKey={0} />)

    expect(await screen.findByText('Bear Case')).toBeInTheDocument()
    expect(screen.getByText('-8.2%')).toBeInTheDocument()
  })

  it('shows "Not checked yet" before the first scheduled check', async () => {
    fetchJson.mockResolvedValue({
      savedScenarios: [{ _id: 's1', name: 'Bear Case', alertThresholdPercent: -15, lastPercentageChange: null, lastCheckedAt: null }],
    })

    render(<SavedScenariosWatchlist refreshKey={0} />)

    expect(await screen.findByText(/Not checked yet/)).toBeInTheDocument()
  })

  it('re-fetches when refreshKey changes', async () => {
    fetchJson.mockResolvedValue({ savedScenarios: [] })
    const { rerender } = render(<SavedScenariosWatchlist refreshKey={0} />)
    await waitFor(() => expect(fetchJson).toHaveBeenCalledTimes(1))

    rerender(<SavedScenariosWatchlist refreshKey={1} />)
    await waitFor(() => expect(fetchJson).toHaveBeenCalledTimes(2))
  })

  it('deletes a saved scenario and removes it from the list', async () => {
    fetchJson.mockResolvedValueOnce({
      savedScenarios: [{ _id: 's1', name: 'Bear Case', alertThresholdPercent: -15, lastPercentageChange: -8, lastCheckedAt: '2026-08-30T12:00:00.000Z' }],
    })
    const user = userEvent.setup()

    render(<SavedScenariosWatchlist refreshKey={0} />)
    await screen.findByText('Bear Case')

    fetchJson.mockResolvedValueOnce({ message: 'Saved scenario removed.' })
    await user.click(screen.getByLabelText('Stop watching Bear Case'))

    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith('/api/portfolio/scenarios/saved/s1', { method: 'DELETE' }))
    expect(screen.queryByText('Bear Case')).not.toBeInTheDocument()
  })
})
