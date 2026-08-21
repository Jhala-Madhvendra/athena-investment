import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScenarioExplanationPanel from '../ScenarioExplanationPanel'
import { fetchJson } from '../../../../lib/api'

vi.mock('../../../../lib/api', () => ({ fetchJson: vi.fn() }))

const resultFixture = {
  scenario: { name: 'Bear Case', rules: [{ targetType: 'MARKET', target: null, shockPercent: -20 }] },
  currentPortfolioValueUSD: 100000,
  scenarioPortfolioValueUSD: 88000,
  absoluteChangeUSD: -12000,
  percentageChange: -12,
  holdingImpact: [],
  sectorImpact: [],
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ScenarioExplanationPanel', () => {
  it('does not call the API until the user clicks Explain', () => {
    render(<ScenarioExplanationPanel result={resultFixture} />)
    expect(fetchJson).not.toHaveBeenCalled()
    expect(screen.getByText(/it only restates figures already shown above/i)).toBeInTheDocument()
  })

  it('sends the scenario result the panel was given and renders the returned prose', async () => {
    const user = userEvent.setup()
    fetchJson.mockResolvedValue({ explanation: 'The portfolio falls 12% under this scenario.', generatedAt: '2026-08-21T00:00:00.000Z' })

    render(<ScenarioExplanationPanel result={resultFixture} />)
    await user.click(screen.getByRole('button', { name: /explain this result/i }))

    await waitFor(() => expect(screen.getByText(/the portfolio falls 12% under this scenario/i)).toBeInTheDocument())

    expect(fetchJson).toHaveBeenCalledWith('/api/portfolio/scenarios/explain', {
      method: 'POST',
      body: JSON.stringify(resultFixture),
    })
  })

  it('shows a loading state while the request is in flight', async () => {
    const user = userEvent.setup()
    let resolveRequest
    fetchJson.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))

    render(<ScenarioExplanationPanel result={resultFixture} />)
    await user.click(screen.getByRole('button', { name: /explain this result/i }))

    expect(screen.getByRole('button', { name: /explaining/i })).toBeDisabled()

    resolveRequest({ explanation: 'Done.', generatedAt: '2026-08-21T00:00:00.000Z' })
    await waitFor(() => expect(screen.getByText('Done.')).toBeInTheDocument())
  })

  it('renders an error state and lets the user retry when the request fails', async () => {
    const user = userEvent.setup()
    fetchJson.mockRejectedValue(new Error('The AI provider did not return a usable scenario explanation.'))

    render(<ScenarioExplanationPanel result={resultFixture} />)
    await user.click(screen.getByRole('button', { name: /explain this result/i }))

    await waitFor(() => expect(screen.getByText(/couldn't generate explanation/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /explain this result/i })).not.toBeDisabled()
  })

  it('always shows the "not financial advice" disclaimer', () => {
    render(<ScenarioExplanationPanel result={resultFixture} />)
    expect(screen.getByText(/not financial advice, not a forecast/i)).toBeInTheDocument()
  })
})
