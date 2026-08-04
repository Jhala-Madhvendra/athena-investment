import { useEffect, useMemo, useState } from 'react'
import FinancialAnalysis from './FinancialAnalysis'

const statementTabs = {
  incomeStatement: {
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
    label: 'Cash Flow',
    rows: [
      ['operatingCashFlow', 'Operating Cash Flow'],
      ['capitalExpenditure', 'Capital Expenditure'],
      ['investingCashFlow', 'Investing Cash Flow'],
      ['financingCashFlow', 'Financing Cash Flow'],
      ['freeCashFlow', 'Free Cash Flow'],
    ],
  },
  analysis: {
    label: 'Financial Analysis',
    isAnalysis: true,
  },
}

const formatValue = (value, field) => {
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

function FinancialStatements({ ticker }) {
  const [activeStatement, setActiveStatement] = useState('incomeStatement')
  const [financialStatements, setFinancialStatements] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

    const loadFinancialStatements = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/financials/${encodeURIComponent(ticker)}`,
          { signal: controller.signal },
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load financial statements.')
        }

        setFinancialStatements(data.financialStatements || [])
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadFinancialStatements()

    return () => controller.abort()
  }, [ticker])

  const activeTab = statementTabs[activeStatement]
  const years = useMemo(
    () => financialStatements.map((statement) => statement.year),
    [financialStatements],
  )

  return (
    <section className="financial-statements" aria-labelledby="financial-statements-title">
      <div className="financial-statements__header">
        <div>
          <p className="financial-statements__eyebrow">Company analysis</p>
          <h1 id="financial-statements-title">Financial Statements</h1>
          <p className="financial-statements__subtitle">
            {ticker.toUpperCase()} annual reported figures
          </p>
        </div>
      </div>

      <div className="financial-statements__tabs" role="tablist" aria-label="Financial statements">
        {Object.entries(statementTabs).map(([statementKey, statement]) => (
          <button
            key={statementKey}
            type="button"
            className={`financial-statements__tab ${
              activeStatement === statementKey ? 'is-active' : ''
            }`}
            role="tab"
            aria-selected={activeStatement === statementKey}
            onClick={() => setActiveStatement(statementKey)}
          >
            {statement.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="financial-statements__state">Loading financial statements…</p>}

      {!isLoading && error && (
        <p className="financial-statements__state financial-statements__state--error">{error}</p>
      )}

      {!isLoading && !error && financialStatements.length === 0 && (
        <p className="financial-statements__state">
          No financial statements have been imported for {ticker.toUpperCase()} yet.
        </p>
      )}

      {!isLoading && !error && financialStatements.length > 0 && (
        activeStatement === 'analysis' ? (
          <FinancialAnalysis ticker={ticker} />
        ) : (
          <div className="financial-statements__table-wrap">
            <table className="financial-statements__table">
              <caption>{activeTab.label} — values in reported units</caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {years.map((year) => (
                    <th key={year} scope="col">
                      FY {year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTab.rows.map(([field, label]) => (
                  <tr key={field}>
                    <th scope="row">{label}</th>
                    {financialStatements.map((statement) => (
                      <td key={`${statement.year}-${field}`}>
                        {formatValue(statement[activeStatement]?.[field], field)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  )
}

export default FinancialStatements
