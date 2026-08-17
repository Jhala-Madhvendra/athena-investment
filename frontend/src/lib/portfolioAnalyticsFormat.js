/** A plain decimal ratio (beta, Sharpe) - unsigned formatting, unlike formatPercent which always shows a sign. */
export const formatRatio = (value, decimals = 2) => (typeof value === 'number' ? value.toFixed(decimals) : '—')

/** A correlation coefficient, always signed so +/- reads at a glance. */
export const formatCorrelation = (value) => {
  if (typeof value !== 'number') return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

/** HHI on the standard 0-10,000 antitrust-convention scale. */
export const formatHHI = (value) => (typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—')

export const formatDate = (isoDate) => {
  if (!isoDate) return '—'
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// --color-brand-500 - same single-hue sequential wash SensitivityTable.jsx uses for a
// magnitude that isn't good/bad (correlation strength here, intrinsic value/share there).
// A red/green diverging scale would visually imply "high correlation is bad", which the
// product deliberately does not claim - see Correlation.md.
const BRAND_RGB = '42, 120, 214'

/** Correlation-cell background intensity - |correlation| only, sign shown in the text, never in color. */
export const correlationCellStyle = (value) => {
  if (typeof value !== 'number') return undefined
  const alpha = 0.08 + Math.min(1, Math.abs(value)) * 0.34
  return { backgroundColor: `rgba(${BRAND_RGB}, ${alpha.toFixed(3)})` }
}
