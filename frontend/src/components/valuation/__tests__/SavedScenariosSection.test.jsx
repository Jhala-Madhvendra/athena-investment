import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavedScenariosSection from '../SavedScenariosSection'
import { fetchJson } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ fetchJson: vi.fn() }))

const assumptions = {
  forecastYears: 5,
  revenueGrowth: 0.1,
  ebitMargin: 0.25,
  taxRate: 0.21,
  depreciationPercentRevenue: 0.03,
  capexPercentRevenue: 0.04,
  workingCapitalPercentRevenue: 0.01,
  terminalGrowthRate: 0.025,
  riskFreeRate: 0.04,
  beta: 1.1,
  equityRiskPremium: 0.05,
  preTaxCostOfDebt: 0.06,
}

const scenarioFixture = (overrides = {}) => ({
  _id: 's1',
  name: 'Base case',
  createdAt: '2026-01-01T00:00:00.000Z',
  priceAtSave: 190,
  impliedValuePerShareAtSave: 210,
  ...overrides,
})

const mockApi = ({ list = { scenarios: [] }, save, del, compare, backtest } = {}) => {
  fetchJson.mockImplementation((path, options = {}) => {
    const method = options.method || 'GET'
    if (path.endsWith('/dcf/saved') && method === 'GET') return Promise.resolve(list)
    if (path.endsWith('/dcf/saved') && method === 'POST') {
      if (save?.__error) return Promise.reject(Object.assign(new Error(save.message), { errors: save.errors }))
      return Promise.resolve(save ?? { scenario: scenarioFixture(), dcfResult: {} })
    }
    if (path.includes('/dcf/saved/') && path.endsWith('/backtest')) {
      if (backtest?.__error) return Promise.reject(new Error(backtest.message))
      return Promise.resolve(backtest)
    }
    if (path.endsWith('/dcf/saved/compare')) {
      if (compare?.__error) return Promise.reject(new Error(compare.message))
      return Promise.resolve(compare)
    }
    if (path.includes('/dcf/saved/') && method === 'DELETE') {
      if (del?.__error) return Promise.reject(new Error(del.message))
      return Promise.resolve({})
    }
    return Promise.reject(new Error(`Unhandled path in mockApi: ${path}`))
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('SavedScenariosSection', () => {
  it('shows an empty state when there are no saved scenarios', async () => {
    mockApi()
    render(<SavedScenariosSection ticker="AAPL" assumptions={assumptions} />)

    expect(await screen.findByText('No saved scenarios yet')).toBeInTheDocument()
  })

  it('lists saved scenarios with their price and implied value at save time', async () => {
    mockApi({ list: { scenarios: [scenarioFixture()] } })
    render(<SavedScenariosSection ticker="AAPL" assumptions={assumptions} />)

    expect(await screen.findByText('Base case')).toBeInTheDocument()
    expect(screen.getByText('210.00')).toBeInTheDocument()
    expect(screen.getByText('190.00')).toBeInTheDocument()
  })

  it('saves the current assumptions under a user-provided name', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<SavedScenariosSection ticker="AAPL" assumptions={assumptions} />)

    await screen.findByText('No saved scenarios yet')
    await user.click(screen.getByRole('button', { name: 'Save Current Assumptions' }))
    await user.type(screen.getByLabelText('Scenario name'), 'Aggressive growth')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith(
        '/api/valuation/AAPL/dcf/saved',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Aggressive growth', ...assumptions }),
        })
      )
    )
  })

  it('requires at least 2 selected scenarios before enabling Compare', async () => {
    mockApi({ list: { scenarios: [scenarioFixture(), scenarioFixture({ _id: 's2', name: 'Bull case' })] } })
    const user = userEvent.setup()
    render(<SavedScenariosSection ticker="AAPL" assumptions={assumptions} />)

    await screen.findByText('Base case')
    const compareButton = screen.getByRole('button', { name: /Compare Selected/i })
    expect(compareButton).toBeDisabled()

    await user.click(screen.getByLabelText('Select Base case for comparison'))
    expect(compareButton).toBeDisabled()

    await user.click(screen.getByLabelText('Select Bull case for comparison'))
    expect(compareButton).not.toBeDisabled()
  })

  it('deletes a saved scenario', async () => {
    mockApi({ list: { scenarios: [scenarioFixture()] } })
    const user = userEvent.setup()
    render(<SavedScenariosSection ticker="AAPL" assumptions={assumptions} />)

    await screen.findByText('Base case')
    await user.click(screen.getByLabelText('Delete Base case'))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/api/valuation/AAPL/dcf/saved/s1', { method: 'DELETE' })
    )
  })

  it('expands a backtest inline, showing labeled numbers without a right/wrong verdict', async () => {
    mockApi({
      list: { scenarios: [scenarioFixture()] },
      backtest: {
        scenarioName: 'Base case',
        priceAtSave: 190,
        currentPrice: 205,
        priceChangeSinceSavePercent: 7.89,
        impliedValuePerShareAtSave: 210,
        impliedValuePerShareNow: 215,
        upsideDownsidePercentNow: 4.88,
        disclaimer: 'DCF valuation is highly sensitive to assumptions.',
      },
    })
    const user = userEvent.setup()
    render(<SavedScenariosSection ticker="AAPL" assumptions={assumptions} />)

    await screen.findByText('Base case')
    await user.click(screen.getByRole('button', { name: 'Backtest' }))

    expect(await screen.findByText(/190\.00.*205\.00/)).toBeInTheDocument()
    expect(screen.getByText('+7.9%')).toBeInTheDocument()
    const bodyText = document.body.textContent
    expect(bodyText).not.toMatch(/\bcorrect\b|\bincorrect\b|\bright\b|\bwrong\b/i)
  })
})
