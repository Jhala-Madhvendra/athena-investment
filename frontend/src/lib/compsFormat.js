import { formatValue } from './statementTabs'

/** Large money figures (market cap, revenue, EBITDA, book value, implied equity value, ...), abbreviated with a currency suffix. */
export const formatMoney = (value, currency) => {
  if (value === null || value === undefined) return '—'
  return `${formatValue(value)}${currency ? ` ${currency}` : ''}`
}

/** Per-share price figures - never abbreviated, always two decimals, matching MarketPriceComparison's convention. */
export const formatPerShare = (value, currency) => {
  if (typeof value !== 'number') return '—'
  return `${value.toFixed(2)}${currency ? ` ${currency}` : ''}`
}

/** A trading multiple, e.g. 12.4x. Never shown for a null (excluded/non-meaningful) observation. */
export const formatMultiple = (value) => (typeof value === 'number' ? `${value.toFixed(1)}x` : '—')

/** A signed percentage - upside/downside gaps, never framed as a recommendation. */
export const formatPercent = (value) => {
  if (typeof value !== 'number') return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}
