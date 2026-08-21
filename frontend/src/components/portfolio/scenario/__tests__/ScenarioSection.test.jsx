import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScenarioSection from '../ScenarioSection'
import { fetchJson } from '../../../../lib/api'

vi.mock('../../../../lib/api', () => ({ fetchJson: vi.fn() }))

const presetsFixture = {
  presets: [
    {
      key: 'bear',
      name: 'Bear Case',
      description: 'A hypothetical broad market decline.',
      isHypothetical: true,
      rules: [{ targetType: 'MARKET', target: null, shockPercent: -15 }],
    },
  ],
}

const runResultFixture = (overrides = {}) => ({
  scenario: { name: 'Custom Scenario', rules: [{ targetType: 'ASSET', target: 'AAPL', shockPercent: -30 }] },
  currentPortfolioValueUSD: 200000,
  scenarioPortfolioValueUSD: 140000,
  absoluteChangeUSD: -60000,
  percentageChange: -30,
  holdingImpact: [
    {
      ticker: 'AAPL',
      sector: 'Technology',
      currentValueUSD: 200000,
      appliedRule: { targetType: 'ASSET', target: 'AAPL', shockPercent: -30 },
      effectiveShockPercent: -30,
      scenarioValueUSD: 140000,
      absoluteChangeUSD: -60000,
      portfolioImpactPercentagePoints: -30,
      contributionToScenarioImpactPercent: 100,
      unaffected: false,
    },
  ],
  sectorImpact: [
    { sector: 'Technology', currentValueUSD: 200000, scenarioValueUSD: 140000, absoluteChangeUSD: -60000, portfolioImpactPercentagePoints: -30, contributionToScenarioImpactPercent: 100 },
  ],
  sensitivity: null,
  historicalContext: { available: false, message: 'Historical context unavailable for the selected period.' },
  assumptions: {
    scenarioName: 'Custom Scenario',
    rules: [{ targetType: 'ASSET', target: 'AAPL', shockPercent: -30 }],
    portfolioValueUSD: 200000,
    dataTimestamp: '2026-08-19T00:00:00.000Z',
    unpricedHoldingsExcluded: [],
    betaUsed: null,
    betaCoveragePercent: null,
    unmatchedRules: [],
    methodologyNotes: ['This is a hypothetical scenario, not a forecast or prediction.'],
  },
  ...overrides,
})

const mockScenarioApi = ({ presets = presetsFixture, run, compare } = {}) => {
  fetchJson.mockReset()
  fetchJson.mockImplementation((path, options = {}) => {
    const method = options.method || 'GET'
    if (path === '/api/portfolio/scenarios/presets') return Promise.resolve(presets)
    if (path === '/api/portfolio/scenarios/run' && method === 'POST') {
      if (run?.__error) return Promise.reject(new Error(run.message))
      return Promise.resolve(typeof run === 'function' ? run(JSON.parse(options.body)) : run || runResultFixture())
    }
    if (path === '/api/portfolio/scenarios/compare' && method === 'POST') {
      return Promise.resolve(compare)
    }
    return Promise.reject(new Error(`mockScenarioApi: no mock registered for ${method} ${path}`))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ScenarioSection - empty portfolio', () => {
  it('shows an empty state and never calls the presets API', () => {
    mockScenarioApi()
    render(<ScenarioSection holdingsCount={0} />)

    expect(screen.getByText(/no scenarios yet/i)).toBeInTheDocument()
    expect(fetchJson).not.toHaveBeenCalled()
  })
})

describe('ScenarioSection - loading presets', () => {
  it('fetches and renders preset buttons on mount', async () => {
    mockScenarioApi()
    render(<ScenarioSection holdingsCount={3} />)

    await waitFor(() => expect(screen.getByText('Bear Case')).toBeInTheDocument())
    expect(fetchJson).toHaveBeenCalledWith('/api/portfolio/scenarios/presets', undefined, expect.any(Object))
  })

  it('loads a preset into the rule list when clicked', async () => {
    mockScenarioApi()
    render(<ScenarioSection holdingsCount={3} />)

    await waitFor(() => expect(screen.getByText('Bear Case')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bear Case'))

    expect(screen.getByText('Market')).toBeInTheDocument()
    expect(screen.getByText('-15%')).toBeInTheDocument()
  })
})

/** Fills the "Add rule" row for an ASSET shock and submits it - shared by every test that needs a non-preset rule in the builder. */
const addAssetRule = async (user, ticker, shockPercent) => {
  await user.selectOptions(screen.getByLabelText('Target'), 'ASSET')
  await user.type(screen.getByLabelText(/ticker/i), ticker)
  await user.type(screen.getByLabelText(/shock %/i), String(shockPercent))
  await user.click(screen.getByRole('button', { name: /add rule/i }))
}

describe('ScenarioSection - adding a rule and running a scenario', () => {
  it('adds a rule via the builder, runs the scenario, and shows the result', async () => {
    const user = userEvent.setup()
    mockScenarioApi({ run: runResultFixture() })
    render(<ScenarioSection holdingsCount={1} />)

    await waitFor(() => expect(screen.getByText('Bear Case')).toBeInTheDocument())

    await addAssetRule(user, 'aapl', -30)

    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }))

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith(
        '/api/portfolio/scenarios/run',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Custom Scenario',
            rules: [{ targetType: 'ASSET', target: 'AAPL', shockPercent: -30 }],
            window: '1y',
          }),
        })
      )
    )

    // "AAPL" now appears twice - the rule chip and the result table row - once the builder
    // normalizes the typed ticker to uppercase, matching what the backend would send back.
    expect(await screen.findAllByText('AAPL')).toHaveLength(2)
    expect(screen.getByText(/hypothetical - not a forecast/i)).toBeInTheDocument()
  })

  it('never treats the run as successful when the API rejects it', async () => {
    mockScenarioApi({ run: { __error: true, message: 'Invalid scenario request.' } })
    render(<ScenarioSection holdingsCount={1} />)

    await waitFor(() => expect(screen.getByText('Bear Case')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bear Case'))
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }))

    expect(await screen.findByText(/couldn't run scenario/i)).toBeInTheDocument()
  })
})

describe('ScenarioSection - unmatched rule warning', () => {
  it('shows a warning banner when a SECTOR/INDUSTRY rule matched no holdings (e.g. a typo)', async () => {
    const fixture = runResultFixture()
    fixture.assumptions.unmatchedRules = [{ targetType: 'INDUSTRY', target: 'Consumer Electric', shockPercent: -10 }]
    mockScenarioApi({ run: fixture })
    render(<ScenarioSection holdingsCount={1} />)

    await waitFor(() => expect(screen.getByText('Bear Case')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bear Case'))
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }))

    expect(await screen.findByText(/this rule matched no holdings/i)).toBeInTheDocument()
    expect(screen.getByText(/industry "consumer electric"/i)).toBeInTheDocument()
  })

  it('shows no warning banner when every rule matched', async () => {
    mockScenarioApi({ run: runResultFixture() })
    render(<ScenarioSection holdingsCount={1} />)

    await waitFor(() => expect(screen.getByText('Bear Case')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bear Case'))
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }))

    await waitFor(() => expect(screen.getByText(/hypothetical - not a forecast/i)).toBeInTheDocument())
    expect(screen.queryByText(/matched no holdings/i)).not.toBeInTheDocument()
  })
})

describe('ScenarioSection - comparison flow', () => {
  it('requires at least two scenarios before Compare is enabled, then renders the comparison table', async () => {
    const user = userEvent.setup()
    mockScenarioApi({
      run: runResultFixture(),
      compare: {
        scenarios: [],
        comparisonTable: [
          { name: 'Custom Scenario', scenarioPortfolioValueUSD: 140000, absoluteChangeUSD: -60000, percentageChange: -30 },
          { name: 'Bear Case', scenarioPortfolioValueUSD: 170000, absoluteChangeUSD: -30000, percentageChange: -15 },
        ],
      },
    })
    render(<ScenarioSection holdingsCount={1} />)
    await waitFor(() => expect(screen.getByText('Bear Case')).toBeInTheDocument())

    // Add a rule, run the (default-named) custom scenario, and add it to the comparison list.
    await addAssetRule(user, 'aapl', -30)
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }))
    await screen.findByText(/hypothetical - not a forecast/i)
    fireEvent.click(screen.getByRole('button', { name: /add to comparison/i }))

    const compareBar = screen.getByText(/ready to compare/i).closest('div')
    expect(within(compareBar).getByText(/add one more to compare/i)).toBeInTheDocument()

    // Load Bear preset (different name) and add it too.
    fireEvent.click(screen.getByText('Bear Case'))
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }))
    await waitFor(() => expect(fetchJson).toHaveBeenCalledTimes(3)) // presets + 2 runs
    fireEvent.click(screen.getByRole('button', { name: /add to comparison/i }))

    const compareButton = await screen.findByRole('button', { name: /^compare$/i })
    fireEvent.click(compareButton)

    expect(await screen.findByText('Scenario Comparison')).toBeInTheDocument()
    expect(fetchJson).toHaveBeenCalledWith(
      '/api/portfolio/scenarios/compare',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
