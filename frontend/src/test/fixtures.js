export const companyFixture = {
  company: {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQGS',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    country: 'United States',
    currency: 'USD',
  },
};

export const quoteFixture = {
  ticker: 'AAPL',
  currency: 'USD',
  price: {
    current: 313.33,
    previousClose: 312.41,
    marketCap: 4572794322944,
    fiftyTwoWeekHigh: 344.57,
    fiftyTwoWeekLow: 223.78,
  },
  valuation: { peRatio: 35.97, priceToBook: 42.57 },
  dividend: { yield: 0.0034 },
};

export const performanceFixture = {
  performance: { '1M': -0.02, '3M': 6.82, '6M': 14.1, '1Y': 36.62, '5Y': 114.48 },
};

export const analysisFixture = {
  ticker: 'AAPL',
  growth: { revenueCAGR: 0.0181, netIncomeCAGR: 0.0392 },
  trends: {
    revenue: { direction: '→' },
    netIncome: { direction: '⚠' },
    operatingMargin: { direction: '→' },
    cashFlow: { direction: '→' },
    debtGrowth: { direction: '↓' },
  },
  insights: [
    { category: 'profitMargin', categoryLabel: 'Profit Margin', text: 'Profit margins are stable at 31.97%.', confidence: 80, forward: 'Consistent margins indicate predictable profit generation.' },
  ],
  healthScore: { overall: 48, label: 'Weak', riskLevel: 'material', components: {}, explanation: 'Financial challenges; concerns require attention.' },
};

export const ratiosFixture = {
  ratios: {
    profitability: {
      returnOnEquity: { value: 151.91 },
      netProfitMargin: { value: 26.92 },
      operatingMargin: { value: 31.97 },
    },
    solvency: { debtToEquity: { value: 1.34 } },
    cashFlow: { freeCashFlow: { value: 124200000000 } },
  },
};

export const financialStatementsFixture = [
  {
    year: 2025,
    incomeStatement: { totalRevenue: 416200000000, netIncome: 112000000000 },
    balanceSheet: { totalDebt: 98700000000 },
  },
];
