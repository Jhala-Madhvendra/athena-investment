/** Fixtures for the Industry & Sector Intelligence tab, matching backend/industry/industry.formatter.js's response shapes. */

export const industryResponseFixture = {
  ticker: 'TARGET',
  company: 'Target Co',
  sector: 'Technology',
  industry: 'Software',
  universe: { level: 'industry', key: 'Software', size: 4, note: 'Industry benchmark based on 4 tracked companies in "Software" with imported financial statements.' },
  benchmarks: [],
  positioning: [
    { metric: 'operatingMargin', label: 'Operating Margin', unit: 'percent', percentile: 78, note: 'Operating Margin is around the 78th percentile of the reference universe.' },
    { metric: 'revenueGrowth', label: 'Revenue Growth', unit: 'percent', percentile: null, note: 'Not available.' },
  ],
  strengths: [
    { metric: 'operatingMargin', label: 'Operating Margin', company: 28, industryMedian: 21, difference: 7, note: '+7.0 percentage points versus the industry median.' },
  ],
  weaknesses: [
    { metric: 'netMargin', label: 'Net Margin', company: 10, industryMedian: 18, difference: -8, note: '-8.0 percentage points versus the industry median.' },
  ],
  growthComparison: [
    { metric: 'revenueGrowth', label: 'Revenue Growth', unit: 'percent', company: 15, industryMedian: 11, difference: 4, relative: null, available: true, note: '+4.0 percentage points versus the industry median.' },
  ],
  profitabilityComparison: [
    { metric: 'operatingMargin', label: 'Operating Margin', unit: 'percent', company: 28, industryMedian: 21, difference: 7, relative: null, available: true, note: '+7.0 percentage points versus the industry median.' },
    { metric: 'netMargin', label: 'Net Margin', unit: 'percent', company: 10, industryMedian: 18, difference: -8, relative: null, available: true, note: '-8.0 percentage points versus the industry median.' },
  ],
  valuationComparison: [
    { metric: 'pe', label: 'P/E', unit: 'multiple', company: 27, industryMedian: 23, difference: null, relative: 1.17, available: true, note: 'Trading at 1.17x the industry median.' },
  ],
  dataFreshness: { financialPeriod: 2025, financialStatementSource: 'yahoo', marketDataAsOf: '2026-08-16T00:00:00.000Z' },
  methodology: 'Industry benchmarks use the median of the reference universe...',
  disclaimer: 'Industry Intelligence reflects Athena\'s own tracked company database, not a complete industry census. It is not investment advice.',
  calculatedAt: '2026-08-16T00:00:00.000Z',
};

export const industryPeersFixture = {
  ticker: 'TARGET',
  universe: { level: 'industry', key: 'Software', size: 4, note: 'note' },
  peers: [
    { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', industry: 'Application Software', marketCap: 3000000, revenueGrowth: 12, operatingMargin: 40, pe: 30 },
  ],
  limitation: 'These are potential comparable companies suggested from Athena\'s own tracked database, ranked by closest market capitalization within the reference universe - not an automatically computed or canonical peer set.',
  generatedAt: '2026-08-16T00:00:00.000Z',
};
