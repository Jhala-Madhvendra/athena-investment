const labeled = (value, source, note = 'Fixture note.') => ({ value, source, note });

export const defaultsFixture = {
  ticker: 'AAPL',
  latestFiscalYear: 2025,
  historicalFCFF: [
    {
      year: 2024,
      ebit: 1000,
      taxRate: 0.2,
      depreciationAndAmortization: 100,
      capitalExpenditure: 150,
      netWorkingCapital: 200,
      changeInNWC: null,
      fcff: null,
      available: false,
    },
    {
      year: 2025,
      ebit: 1100,
      taxRate: 0.21,
      depreciationAndAmortization: 110,
      capitalExpenditure: 160,
      netWorkingCapital: 220,
      changeInNWC: 20,
      fcff: 799,
      available: true,
    },
  ],
  suggestedAssumptions: {
    forecastYears: labeled(5, 'default', 'Sprint-standard 5-year explicit forecast period.'),
    revenueGrowth: labeled(0.05, 'derived', '2-year historical revenue CAGR.'),
    ebitMargin: labeled(0.2, 'derived', "Latest reported year's Operating Income / Revenue."),
    taxRate: labeled(0.21, 'derived', "Latest reported year's Tax Provision / Pretax Income."),
    depreciationPercentRevenue: labeled(0.03, 'derived', "Latest reported year's D&A / Revenue."),
    capexPercentRevenue: labeled(0.04, 'derived', "Latest reported year's CapEx / Revenue."),
    workingCapitalPercentRevenue: labeled(0.02, 'derived', 'NWC / Revenue for the latest reported year.'),
    terminalGrowthRate: labeled(0.025, 'illustrative_default', 'Not company-specific or live data.'),
  },
  waccInputs: {
    riskFreeRate: labeled(0.045, 'market', '10-Year US Treasury yield, fetched live from Yahoo Finance.'),
    beta: labeled(1.1, 'market', 'From Yahoo Finance.'),
    equityRiskPremium: labeled(0.05, 'illustrative_default', 'Not company-specific or live data.'),
    preTaxCostOfDebt: labeled(null, 'required_user_input', 'Athena has no interest expense data for this ticker.'),
  },
  capitalStructure: {
    debt: labeled(400, 'historical'),
    cash: labeled(300, 'historical'),
    dilutedShares: labeled(100, 'historical'),
    marketValueOfEquity: labeled(5000, 'market'),
  },
  currentMarketPrice: labeled(150, 'market'),
};

const buildForecastDetail = () =>
  Array.from({ length: 5 }, (_, index) => {
    const year = index + 1;
    return {
      year,
      revenue: 1000 + year * 50,
      ebit: 200 + year * 10,
      nopat: 160 + year * 8,
      depreciationAndAmortization: 30 + year,
      capitalExpenditure: 40 + year,
      netWorkingCapital: 20 + year,
      changeInNWC: 2,
      fcff: 150 + year * 5,
      discountFactor: Number((1 / (1 + 0.095) ** year).toFixed(4)),
      presentValue: Number(((150 + year * 5) / (1 + 0.095) ** year).toFixed(2)),
    };
  });

export const dcfResultFixture = {
  isValid: true,
  errors: [],
  ticker: 'AAPL',
  forecastDetail: buildForecastDetail(),
  projectedFCFF: [155, 160, 165, 170, 175],
  discountFactors: [0.9132, 0.8339, 0.7615, 0.6954, 0.635],
  pvOfFCFF: 700,
  terminalValue: 2200,
  pvOfTerminalValue: 1397,
  enterpriseValue: 2097,
  netDebt: 100,
  equityValue: 1997,
  intrinsicValuePerShare: 19.97,
  capitalStructure: { debt: 400, cash: 300, dilutedShares: 100 },
  historicalFCFF: defaultsFixture.historicalFCFF,
  waccBreakdown: {
    costOfEquity: 0.1,
    afterTaxCostOfDebt: 0.0405,
    marketValueOfEquity: 5000,
    marketValueOfDebt: 400,
    wacc: 0.095,
  },
  currentMarketPrice: 150,
  upsideDownsidePercent: -86.69,
  disclaimer: 'DCF valuation is highly sensitive to assumptions and should not be interpreted as a guaranteed future price.',
  calculatedAt: '2026-08-09T00:00:00.000Z',
};

export const scenariosFixture = {
  isValid: true,
  ticker: 'AAPL',
  waccBreakdown: dcfResultFixture.waccBreakdown,
  deltas: {
    bear: { revenueGrowth: -0.02, ebitMargin: -0.02 },
    base: { revenueGrowth: 0, ebitMargin: 0 },
    bull: { revenueGrowth: 0.02, ebitMargin: 0.02 },
  },
  scenarios: {
    bear: { isValid: true, intrinsicValuePerShare: 14.5, upsideDownsidePercent: -90.33, currentMarketPrice: 150 },
    base: { isValid: true, intrinsicValuePerShare: 19.97, upsideDownsidePercent: -86.69, currentMarketPrice: 150 },
    bull: { isValid: true, intrinsicValuePerShare: 25.8, upsideDownsidePercent: -82.8, currentMarketPrice: 150 },
  },
  disclaimer: dcfResultFixture.disclaimer,
  calculatedAt: dcfResultFixture.calculatedAt,
};

const buildSensitivityMatrix = () => {
  const waccValues = [0.075, 0.085, 0.095, 0.105, 0.115];
  const terminalGrowthValues = [0.015, 0.02, 0.025, 0.03, 0.035];

  const rows = waccValues.map((wacc) => ({
    wacc,
    cells: terminalGrowthValues.map((terminalGrowthRate) => ({
      wacc,
      terminalGrowthRate,
      isValid: true,
      intrinsicValuePerShare: Number((20 - (wacc - 0.095) * 100 + (terminalGrowthRate - 0.025) * 100).toFixed(2)),
      errors: [],
    })),
  }));

  return { waccValues, terminalGrowthValues, rows };
};

export const sensitivityFixture = {
  isValid: true,
  ticker: 'AAPL',
  baseWacc: 0.095,
  baseTerminalGrowthRate: 0.025,
  matrix: buildSensitivityMatrix(),
  disclaimer: dcfResultFixture.disclaimer,
  calculatedAt: dcfResultFixture.calculatedAt,
};
