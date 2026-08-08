/**
 * Shared statement-table config + formatter, used by both the tab bar
 * (FinancialStatements.jsx) and the table renderer (StatementTable.jsx).
 */
export const statementTabs = {
  incomeStatement: {
    key: 'income-statement',
    label: 'Income Statement',
    rows: [
      ['totalRevenue', 'Total Revenue'],
      ['costOfRevenue', 'Cost of Revenue'],
      ['grossProfit', 'Gross Profit'],
      ['totalOperatingExpenses', 'Operating Expenses'],
      ['operatingIncome', 'Operating Income'],
      ['pretaxIncome', 'Pre-tax Income'],
      ['taxProvision', 'Tax Provision'],
      ['netIncome', 'Net Income'],
      ['basicEPS', 'Basic EPS'],
      ['dilutedEPS', 'Diluted EPS'],
    ],
  },
  balanceSheet: {
    key: 'balance-sheet',
    label: 'Balance Sheet',
    rows: [
      ['cashAndCashEquivalents', 'Cash & Cash Equivalents'],
      ['totalAssets', 'Total Assets'],
      ['totalLiabilities', 'Total Liabilities'],
      ['totalDebt', 'Total Debt'],
      ['totalStockholderEquity', 'Stockholders’ Equity'],
    ],
  },
  cashFlow: {
    key: 'cash-flow',
    label: 'Cash Flow',
    rows: [
      ['operatingCashFlow', 'Operating Cash Flow'],
      ['capitalExpenditure', 'Capital Expenditure'],
      ['investingCashFlow', 'Investing Cash Flow'],
      ['financingCashFlow', 'Financing Cash Flow'],
      ['freeCashFlow', 'Free Cash Flow'],
    ],
  },
}

export const formatValue = (value, field) => {
  if (value === null || value === undefined) {
    return '—'
  }

  if (field === 'basicEPS' || field === 'dilutedEPS') {
    return Number(value).toFixed(2)
  }

  const absoluteValue = Math.abs(value)
  const sign = value < 0 ? '−' : ''

  if (absoluteValue >= 1_000_000_000) {
    return `${sign}${(absoluteValue / 1_000_000_000).toFixed(1)}B`
  }

  if (absoluteValue >= 1_000_000) {
    return `${sign}${(absoluteValue / 1_000_000).toFixed(1)}M`
  }

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}
