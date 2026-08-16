/**
 * Formatting helpers for Industry & Sector Intelligence. Every value on the
 * wire is already a plain number or null (see industry.formatter.js) - this
 * module only decides display strings, never recalculates anything.
 */

/** A metric's own value, formatted per its unit - percent/ratio/multiple are never mixed without a label (see Sprint 13's VISUALIZATION guidance). */
export const formatMetricValue = (value, unit) => {
  if (typeof value !== 'number') return '—'
  if (unit === 'percent') return `${value.toFixed(1)}%`
  if (unit === 'multiple') return `${value.toFixed(1)}x`
  return value.toFixed(2) // ratio (e.g. debt-to-equity)
}

/** Percentage-point difference, always signed - used for percent-unit metrics only. */
export const formatDifference = (value) => {
  if (typeof value !== 'number') return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} pp`
}

/** Plain signed difference for ratio-unit metrics (e.g. debt-to-equity) - not a percentage-point figure. */
export const formatRatioDifference = (value) => {
  if (typeof value !== 'number') return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

/** "1.3x the industry median" framing for valuation multiples - never "cheap"/"expensive" (see Sprint 13 NO INVESTMENT RECOMMENDATIONS). */
export const formatRelative = (value) => {
  if (typeof value !== 'number') return '—'
  return `${value.toFixed(2)}x`
}

/** Renders the "Difference" column for a comparison row, picking the right framing for its unit. */
export const formatComparisonDelta = (entry) => {
  if (!entry.available) return '—'
  if (entry.unit === 'multiple') return formatRelative(entry.relative)
  if (entry.unit === 'ratio') return formatRatioDifference(entry.difference)
  return formatDifference(entry.difference)
}

/** 1st/2nd/3rd/4th... ordinal suffix for percentile display. */
export const ordinal = (n) => {
  if (typeof n !== 'number') return ''
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] || 'th'
  return `${n}${suffix}`
}

export const formatMarketCap = (value) => {
  if (typeof value !== 'number') return '—'
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  return value.toLocaleString()
}
