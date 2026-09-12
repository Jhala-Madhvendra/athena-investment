import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaveScenarioButton from '../SaveScenarioButton'
import { fetchJson } from '../../../../lib/api'

vi.mock('../../../../lib/api', () => ({ fetchJson: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
})

const defaultProps = {
  name: 'Bear Case',
  rules: [{ targetType: 'PORTFOLIO', shockPercent: -20 }],
  benchmark: '',
  window: '1y',
  defaultThresholdPercent: -18.4,
}

describe('SaveScenarioButton', () => {
  it('does not call fetchJson on mount', () => {
    render(<SaveScenarioButton {...defaultProps} />)
    expect(fetchJson).not.toHaveBeenCalled()
  })

  it('pre-fills the threshold from the scenario result, rounded', async () => {
    const user = userEvent.setup()
    render(<SaveScenarioButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Watch this scenario' }))

    expect(screen.getByLabelText(/Alert me if my live portfolio would lose at least/)).toHaveValue(-18)
  })

  it('saves the scenario definition with the edited threshold', async () => {
    fetchJson.mockResolvedValue({ savedScenario: { _id: 's1' } })
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<SaveScenarioButton {...defaultProps} onSaved={onSaved} />)

    await user.click(screen.getByRole('button', { name: 'Watch this scenario' }))
    const input = screen.getByLabelText(/Alert me if my live portfolio would lose at least/)
    await user.clear(input)
    await user.type(input, '-25')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/portfolio/scenarios/saved', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Bear Case',
          rules: defaultProps.rules,
          benchmark: undefined,
          window: '1y',
          alertThresholdPercent: -25,
        }),
      })
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('shows a validation error inline without losing the open form', async () => {
    fetchJson.mockRejectedValue(Object.assign(new Error('alertThresholdPercent must be negative.'), { errors: undefined }))
    const user = userEvent.setup()
    render(<SaveScenarioButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Watch this scenario' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('alertThresholdPercent must be negative.')).toBeInTheDocument()
  })

  it('shows "Saved to Scenario Watch" after a successful save', async () => {
    fetchJson.mockResolvedValue({ savedScenario: { _id: 's1' } })
    const user = userEvent.setup()
    render(<SaveScenarioButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Watch this scenario' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('button', { name: 'Saved to Scenario Watch' })).toBeInTheDocument()
  })
})
