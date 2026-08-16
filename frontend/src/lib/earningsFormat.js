/**
 * Formatting helpers for the Earnings Intelligence page. Mirrors the B/M
 * abbreviation style already used by frontend/src/lib/statementTabs.js's
 * formatValue, but generic (not tied to a specific statement field name) -
 * Earnings needs the same formatting uniformly across growth/cashFlow/
 * balanceSheet metrics rather than a per-field lookup.
 */

export const formatCurrency = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Not available'

  const absoluteValue = Math.abs(value)
  const sign = value < 0 ? '−' : ''

  if (absoluteValue >= 1_000_000_000) return `${sign}$${(absoluteValue / 1_000_000_000).toFixed(1)}B`
  if (absoluteValue >= 1_000_000) return `${sign}$${(absoluteValue / 1_000_000).toFixed(1)}M`
  if (absoluteValue >= 1_000) return `${sign}$${(absoluteValue / 1_000).toFixed(1)}K`

  return `${sign}$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(absoluteValue)}`
}

export const formatEPS = (value) => (typeof value === 'number' ? `$${value.toFixed(2)}` : 'Not available')

export const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Not available'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/** Percentage-POINT change for margin/ROE/ROA metrics - never rendered as a relative percent (see earnings.calculator.js's marginPointChange). */
export const formatPercentagePoints = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Not available'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)} pp`
}

export const formatRatio = (value) => (typeof value === 'number' ? `${value.toFixed(2)}×` : 'Not available')

/** Renders a metric's latest/previous value according to its display type - a currency amount, a margin percent, a per-share dollar figure, or a bare ratio. */
export const formatMetricValue = (value, type) => {
  if (typeof value !== 'number') return 'Not available'
  if (type === 'percent') return `${value.toFixed(1)}%`
  if (type === 'eps') return formatEPS(value)
  if (type === 'ratio') return formatRatio(value)
  return formatCurrency(value)
}

/** Renders a metric's change column: percentage-point change for margins, "absolute (relative%)" for currency metrics, bare relative % for EPS. */
export const formatMetricChange = (metric, type) => {
  if (!metric || !metric.available) return null

  if (type === 'percent') {
    return formatPercentagePoints(metric.pointChange)
  }

  if (type === 'eps') {
    return typeof metric.percentChange === 'number' ? formatPercent(metric.percentChange) : null
  }

  if (typeof metric.absoluteChange === 'number' && typeof metric.percentChange === 'number') {
    return `${formatCurrency(metric.absoluteChange)} (${formatPercent(metric.percentChange)})`
  }

  if (typeof metric.absoluteChange === 'number') {
    return formatCurrency(metric.absoluteChange)
  }

  return null
}
