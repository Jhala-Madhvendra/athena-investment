import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Earnings from '../Earnings'
import { renderWithShellContext } from '../../test/renderWithRouter'
import { mockEarningsFetch, errorResponse } from '../../test/fetchMock'

const earningsFixture = {
  ticker: 'AAPL',
  period: { periodType: 'ANNUAL', latestPeriod: 'FY2026', previousPeriod: 'FY2025', comparisonAvailable: true, comparisonType: 'YoY' },
  growth: {
    revenue: { label: 'Revenue', unit: 'currency', latest: 416161000000, previous: 391035000000, absoluteChange: 25126000000, percentChange: 6.43, available: true },
    operatingIncome: { label: 'Operating Income', unit: 'currency', latest: 133050000000, previous: 123216000000, absoluteChange: 9834000000, percentChange: 7.98, available: true },
    netIncome: { label: 'Net Income', unit: 'currency', latest: 112010000000, previous: 93736000000, absoluteChange: 18274000000, percentChange: 19.5, available: true },
  },
  profitability: {
    operatingMargin: { label: 'Operating Margin', unit: 'percent', latest: 31.97, previous: 31.51, pointChange: 0.46, available: true },
    netMargin: { label: 'Net Profit Margin', unit: 'percent', latest: 26.92, previous: 23.97, pointChange: 2.94, available: true },
    returnOnEquity: { label: 'Return on Equity (ROE)', unit: 'percent', latest: 151.91, previous: 164.59, pointChange: -12.68, available: true },
    returnOnAssets: { label: 'Return on Assets (ROA)', unit: 'percent', latest: 31.18, previous: 25.68, pointChange: 5.5, available: true },
  },
  cashFlow: {
    freeCashFlow: { label: 'Free Cash Flow', unit: 'currency', latest: 98767000000, previous: 108807000000, absoluteChange: -10040000000, percentChange: -9.23, available: true },
    fcfMargin: { label: 'FCF Margin', unit: 'percent', latest: 23.73, previous: 27.83, pointChange: -4.09, available: true },
    fcfConversion: { value: 0.88, available: true, caveat: null },
  },
  balanceSheet: {
    totalDebt: { label: 'Total Debt', unit: 'currency', latest: 98657000000, previous: 106629000000, absoluteChange: -7972000000, percentChange: -7.48, available: true },
    cash: { label: 'Cash & Equivalents', unit: 'currency', latest: 35934000000, previous: 29943000000, absoluteChange: 5991000000, percentChange: 20.01, available: true },
    netDebt: { label: 'Net Debt', unit: 'currency', latest: 62723000000, previous: 76686000000, absoluteChange: -13963000000, percentChange: -18.21, available: true },
  },
  perShare: {
    basicEPS: { label: 'Basic EPS', unit: 'currency', latest: 7.49, previous: 6.11, absoluteChange: 1.38, percentChange: 22.59, available: true },
    dilutedEPS: { label: 'Diluted EPS', unit: 'currency', latest: 7.46, previous: 6.08, absoluteChange: 1.38, percentChange: 22.7, available: true },
  },
  qualityObservations: [
    { type: 'netIncomeVsFcf', text: 'Net income grew 19.5% while free cash flow declined 9.23%. These two measures of profitability moved in different directions this period.' },
  ],
  signals: {
    growth: { revenue: 'Improving', operatingIncome: 'Improving', netIncome: 'Improving' },
    profitability: { operatingMargin: 'Stable', netMargin: 'Stable', returnOnEquity: 'Deteriorating', returnOnAssets: 'Improving' },
    cashFlow: { freeCashFlow: 'Stable', fcfMargin: 'Deteriorating' },
    balanceSheet: { totalDebt: '→', cash: '↑', netDebt: '↓' },
  },
  marketReaction: { available: false, reason: 'No Earnings-category news has been retrieved for this company yet.', basis: null, anchorDate: null, oneDayReturnPercent: null, fiveDayReturnPercent: null },
  relatedNews: [
    { title: 'AAPL beats estimates', description: null, source: 'Yahoo', publishedAt: new Date().toISOString(), category: 'Earnings', url: 'https://example.com/a' },
  ],
  dataFreshness: { financialPeriod: 'FY2026', statementType: 'Annual', financialStatementSource: 'Yahoo Finance', marketObservationDate: null },
  generatedAt: new Date().toISOString(),
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Earnings - loading state', () => {
  it('shows a skeleton and no data while the request is hanging', () => {
    mockEarningsFetch(undefined)
    renderWithShellContext(<Earnings />, { path: 'earnings' })

    expect(screen.queryByText('Performance Summary')).not.toBeInTheDocument()
  })
})

describe('Earnings - successful rendering', () => {
  it('renders the period header and comparison table with signals', async () => {
    mockEarningsFetch(earningsFixture)
    renderWithShellContext(<Earnings />, { path: 'earnings' })

    expect(await screen.findByText(/FY2026 for AAPL/)).toBeInTheDocument()
    expect(screen.getByText(/compared with FY2025 \(YoY\)/)).toBeInTheDocument()

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getAllByText('Improving').length).toBeGreaterThan(0)
    // Margin change is shown in percentage points, never a bare relative percent.
    expect(screen.getByText('+0.5 pp')).toBeInTheDocument()
  })

  it('renders balance-sheet direction arrows, never Improving/Deteriorating, for debt/cash/net debt', async () => {
    mockEarningsFetch(earningsFixture)
    renderWithShellContext(<Earnings />, { path: 'earnings' })

    await screen.findByText('Total Debt')
    expect(screen.getByText('→')).toBeInTheDocument()
    expect(screen.getByText('↑')).toBeInTheDocument()
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('renders EPS rows with no signal badge (available only when both periods report a value)', async () => {
    mockEarningsFetch(earningsFixture)
    renderWithShellContext(<Earnings />, { path: 'earnings' })

    await screen.findByText('Basic EPS')
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0)
  })

  it('renders the earnings quality observation and FCF conversion', async () => {
    mockEarningsFetch(earningsFixture)
    renderWithShellContext(<Earnings />, { path: 'earnings' })

    expect(await screen.findByText(/moved in different directions/)).toBeInTheDocument()
    expect(screen.getByText('0.88×')).toBeInTheDocument()
  })

  it('shows the honest "not evaluated" market reaction message rather than fabricating a number', async () => {
    mockEarningsFetch(earningsFixture)
    renderWithShellContext(<Earnings />, { path: 'earnings' })

    expect(await screen.findByText(/No Earnings-category news has been retrieved/)).toBeInTheDocument()
  })

  it('renders related news via the shared NewsCard component', async () => {
    mockEarningsFetch(earningsFixture)
    renderWithShellContext(<Earnings />, { path: 'earnings' })

    expect(await screen.findByText('AAPL beats estimates')).toBeInTheDocument()
  })
})

describe('Earnings - error state', () => {
  it('shows an error message when the request fails', async () => {
    mockEarningsFetch(errorResponse(404, 'No financial statements are available for this ticker.'))
    renderWithShellContext(<Earnings />, { path: 'earnings' })

    expect(await screen.findByText("Couldn't load earnings intelligence")).toBeInTheDocument()
    expect(screen.getByText('No financial statements are available for this ticker.')).toBeInTheDocument()
  })
})
