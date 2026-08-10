/**
 * Fixtures for the Comparable Companies tab. The numbers mirror the
 * backend's own comps.service.test.js dataset exactly (target revenue
 * 5000 / net income 500 / book value 2500 / EBITDA 1000, peer A fully
 * valid, peer B loss-making so P/E is excluded for it) so the same
 * "median = 20 P/E -> 100/share" arithmetic is exercised on both layers.
 */

export const availablePeersFixture = {
  target: {
    ticker: 'TARGET',
    name: 'Target Co',
    sector: 'Technology',
    industry: 'Software',
    marketCap: 10000,
  },
  candidates: [
    {
      ticker: 'PEERA',
      name: 'Peer A Corp',
      exchange: 'NASDAQ',
      sector: 'Technology',
      industry: 'Software',
      marketCap: 8000,
      revenue: 4000,
      revenueFiscalYear: 2023,
      hasFinancialStatements: true,
    },
    {
      ticker: 'PEERB',
      name: 'Peer B Corp',
      exchange: 'NASDAQ',
      sector: 'Technology',
      industry: 'Software',
      marketCap: 12000,
      revenue: 5000,
      revenueFiscalYear: 2023,
      hasFinancialStatements: true,
    },
    {
      ticker: 'PEERC',
      name: 'Peer C Inc',
      exchange: 'NYSE',
      sector: 'Technology',
      industry: 'Hardware',
      marketCap: null,
      revenue: null,
      revenueFiscalYear: null,
      hasFinancialStatements: false,
    },
  ],
  limitation:
    'These are companies already known to Athena (previously searched or imported), not an automatically ' +
    'computed set of comparable companies. Athena does not score industry similarity, business model, revenue ' +
    'scale, geography, or growth profile. Review each candidate’s sector, industry, market cap, and revenue ' +
    'yourself before adding it as a peer.',
};

const companyMetrics = (overrides) => ({
  ticker: overrides.ticker,
  name: overrides.name,
  price: overrides.price ?? null,
  marketCap: overrides.marketCap,
  enterpriseValue: overrides.enterpriseValue,
  revenue: overrides.revenue,
  ebitda: overrides.ebitda,
  netIncome: overrides.netIncome,
  bookValue: overrides.bookValue,
  debt: overrides.debt,
  cash: overrides.cash,
  dilutedShares: overrides.dilutedShares ?? null,
  multiples: overrides.multiples,
});

const target = companyMetrics({
  ticker: 'TARGET',
  name: 'Target Co',
  price: 100,
  marketCap: 10000,
  enterpriseValue: 11000,
  revenue: 5000,
  ebitda: 1000,
  netIncome: 500,
  bookValue: 2500,
  debt: 2000,
  cash: 1000,
  dilutedShares: 100,
  multiples: {
    pe: { value: 20, excludedReason: null },
    evEbitda: { value: 11, excludedReason: null },
    evRevenue: { value: 2.2, excludedReason: null },
    pb: { value: 4, excludedReason: null },
    ps: { value: 2, excludedReason: null },
  },
});

const peerA = companyMetrics({
  ticker: 'PEERA',
  name: 'Peer A Corp',
  price: 100,
  marketCap: 8000,
  enterpriseValue: 9000,
  revenue: 4000,
  ebitda: 1000,
  netIncome: 400,
  bookValue: 2000,
  debt: 1000,
  cash: 0,
  multiples: {
    pe: { value: 20, excludedReason: null },
    evEbitda: { value: 9, excludedReason: null },
    evRevenue: { value: 2.25, excludedReason: null },
    pb: { value: 4, excludedReason: null },
    ps: { value: 2, excludedReason: null },
  },
});

const peerB = companyMetrics({
  ticker: 'PEERB',
  name: 'Peer B Corp',
  price: 133.33,
  marketCap: 12000,
  enterpriseValue: 13000,
  revenue: 5000,
  ebitda: 1000,
  netIncome: -300,
  bookValue: 3000,
  debt: 1500,
  cash: 500,
  multiples: {
    pe: { value: null, excludedReason: 'Net Income is zero or negative - this multiple is not meaningful for this company.' },
    evEbitda: { value: 13, excludedReason: null },
    evRevenue: { value: 2.6, excludedReason: null },
    pb: { value: 4, excludedReason: null },
    ps: { value: 2.4, excludedReason: null },
  },
});

export const compsResultFixture = {
  isValid: true,
  ticker: 'TARGET',
  targetFiscalYear: 2023,
  target,
  peers: [peerA, peerB],
  unavailablePeers: [],
  notes: [],
  peerStatistics: {
    pe: {
      count: 1,
      min: 20,
      max: 20,
      mean: 20,
      median: 20,
      p25: null,
      p75: null,
      excludedPeers: [{ ticker: 'PEERB', reason: 'Net Income is zero or negative - this multiple is not meaningful for this company.' }],
    },
    evEbitda: { count: 2, min: 9, max: 13, mean: 11, median: 11, p25: null, p75: null, excludedPeers: [] },
    evRevenue: { count: 2, min: 2.25, max: 2.6, mean: 2.425, median: 2.425, p25: null, p75: null, excludedPeers: [] },
    pb: { count: 2, min: 4, max: 4, mean: 4, median: 4, p25: null, p75: null, excludedPeers: [] },
    ps: { count: 2, min: 2, max: 2.4, mean: 2.2, median: 2.2, p25: null, p75: null, excludedPeers: [] },
  },
  statistic: 'median',
  impliedValuations: {
    pe: {
      isApplicable: true,
      multiple: 'P/E',
      basis: 'equity',
      selectedPeerStatistic: 20,
      targetMetric: 500,
      impliedEquityValue: 10000,
      impliedValuePerShare: 100,
      reason: null,
      currentMarketPrice: 100,
      upsideDownsidePercent: 0,
    },
    evEbitda: {
      isApplicable: true,
      multiple: 'EV/EBITDA',
      basis: 'enterprise',
      selectedPeerStatistic: 11,
      targetMetric: 1000,
      impliedEnterpriseValue: 11000,
      netDebt: 1000,
      impliedEquityValue: 10000,
      impliedValuePerShare: 100,
      reason: null,
      currentMarketPrice: 100,
      upsideDownsidePercent: 0,
    },
    evRevenue: {
      isApplicable: true,
      multiple: 'EV/Revenue',
      basis: 'enterprise',
      selectedPeerStatistic: 2.425,
      targetMetric: 5000,
      impliedEnterpriseValue: 12125,
      netDebt: 1000,
      impliedEquityValue: 11125,
      impliedValuePerShare: 111.25,
      reason: null,
      currentMarketPrice: 100,
      upsideDownsidePercent: 11.25,
    },
    pb: {
      isApplicable: true,
      multiple: 'P/B',
      basis: 'equity',
      selectedPeerStatistic: 4,
      targetMetric: 2500,
      impliedEquityValue: 10000,
      impliedValuePerShare: 100,
      reason: null,
      currentMarketPrice: 100,
      upsideDownsidePercent: 0,
    },
    ps: {
      isApplicable: true,
      multiple: 'P/S',
      basis: 'equity',
      selectedPeerStatistic: 2.2,
      targetMetric: 5000,
      impliedEquityValue: 11000,
      impliedValuePerShare: 110,
      reason: null,
      currentMarketPrice: 100,
      upsideDownsidePercent: 10,
    },
  },
  valuationRange: { low: 100, median: 100, high: 111.25, methodologiesApplied: 5 },
  currentMarketPrice: 100,
  marketDataAsOf: '2024-01-01T00:00:00.000Z',
  disclaimer:
    'Comparable Company Analysis is a relative valuation - it reflects how the market is currently pricing the ' +
    'selected peer companies, not an independent estimate of intrinsic value. It is not investment advice, and ' +
    'the implied values here are analytical outputs, not price targets.',
  calculatedAt: '2026-08-09T00:00:00.000Z',
};
