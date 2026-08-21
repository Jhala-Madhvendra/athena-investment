import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HoldingImpactTable from '../HoldingImpactTable'

const holdingFixture = (overrides = {}) => ({
  ticker: 'AAPL',
  sector: 'Technology',
  industry: 'Consumer Electronics',
  appliedRule: { targetType: 'ASSET', target: 'AAPL', shockPercent: -30 },
  effectiveShockPercent: -30,
  currentValueUSD: 200000,
  scenarioValueUSD: 140000,
  absoluteChangeUSD: -60000,
  portfolioImpactPercentagePoints: -30,
  contributionToScenarioImpactPercent: 100,
  unaffected: false,
  ...overrides,
})

describe('HoldingImpactTable', () => {
  it('renders each holding\'s sector and industry so a mistyped scenario rule target can be checked against it', () => {
    render(<HoldingImpactTable holdingImpact={[holdingFixture()]} />)

    expect(screen.getByText('Sector / Industry')).toBeInTheDocument()
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText(/consumer electronics/i)).toBeInTheDocument()
  })

  it('falls back to a dash when a holding has no known sector', () => {
    render(<HoldingImpactTable holdingImpact={[holdingFixture({ sector: null, industry: null })]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders nothing for an empty holdingImpact array', () => {
    const { container } = render(<HoldingImpactTable holdingImpact={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
