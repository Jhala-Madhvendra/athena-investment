import { useEffect, useState } from 'react'

const formatRatioValue = (value, unit) => {
  if (value === null || value === undefined) {
    return '—'
  }

  if (unit === 'percent') {
    return `${value.toFixed(2)}%`
  }

  if (unit === 'ratio') {
    return value.toFixed(2)
  }

  if (unit === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }

  return value.toString()
}

const ratioGroupLabels = {
  profitability: 'Profitability',
  liquidity: 'Liquidity',
  solvency: 'Solvency',
  cashFlow: 'Cash Flow',
  efficiency: 'Efficiency',
}

const ratioDescriptions = {
  grossMargin: 'Measures the percentage of revenue that remains after deducting cost of goods sold.',
  operatingMargin: 'Shows operating income as a share of revenue after operating expenses.',
  netProfitMargin: 'Indicates how much net income is generated from every dollar of revenue.',
  returnOnEquity: 'Measures profitability relative to shareholder equity.',
  returnOnAssets: 'Shows how efficiently assets generate profit.',
  currentRatio: 'Compares current assets to current liabilities for near-term liquidity.',
  quickRatio: 'Measures the ability to cover short-term obligations with liquid assets.',
  debtToEquity: 'Compares debt levels to shareholder equity to assess leverage.',
  debtRatio: 'Shows the portion of assets financed by debt.',
  freeCashFlow: 'Represents cash available after investing in capital expenditures.',
  assetTurnover: 'Measures how efficiently assets produce revenue.',
}

const buildCard = (key, metric) => (
  <article key={key} className="financial-analysis__card">
    <div className="financial-analysis__card-header">
      <h3>{metric.label}</h3>
      <span className="financial-analysis__unit">{metric.available ? metric.unit : 'N/A'}</span>
    </div>
    <p className="financial-analysis__value">{formatRatioValue(metric.value, metric.unit)}</p>
    <p className="financial-analysis__description">{ratioDescriptions[key] || 'Derived from the most recent financial statements.'}</p>
  </article>
)

function FinancialAnalysis({ ticker }) {
  const [ratios, setRatios] = useState(null)
  const [year, setYear] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

    const loadRatios = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/ratios/${encodeURIComponent(ticker)}`,
          { signal: controller.signal },
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load financial analysis.')
        }

        setRatios(data.ratios || {})
        setYear(data.year || null)
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

    loadRatios()

    return () => controller.abort()
  }, [ticker])

  if (isLoading) {
    return <p className="financial-statements__state">Loading financial analysis…</p>
  }

  if (error) {
    return <p className="financial-statements__state financial-statements__state--error">{error}</p>
  }

  if (!ratios) {
    return <p className="financial-statements__state">No financial analysis is available for {ticker.toUpperCase()}.</p>
  }

  return (
    <section className="financial-analysis" aria-labelledby="financial-analysis-title">
      <div className="financial-analysis__intro">
        <div>
          <p className="financial-statements__eyebrow">Financial analysis</p>
          <h2 id="financial-analysis-title">Ratio analysis</h2>
          <p className="financial-analysis__subtitle">
            View the latest ratios for {ticker.toUpperCase()} ({year || 'latest year'}).
          </p>
        </div>
      </div>

      <div className="financial-analysis__grid">
        {Object.entries(ratios).map(([groupKey, groupMetrics]) => (
          <div key={groupKey} className="financial-analysis__group">
            <h3 className="financial-analysis__group-title">{ratioGroupLabels[groupKey]}</h3>
            <div className="financial-analysis__cards">
              {Object.entries(groupMetrics).map(([metricKey, metric]) => buildCard(metricKey, metric))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default FinancialAnalysis
