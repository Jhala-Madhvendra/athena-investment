import { typeLabel } from '../../lib/alertsFormat'

const TYPES = ['MARKET', 'FINANCIAL', 'BUSINESS', 'NEWS', 'PORTFOLIO']

/**
 * All / Unread / <type> chip row, same pattern as news/CategoryFilter.jsx.
 * Valuation is intentionally omitted - no rule in alert.engine.js produces
 * a VALUATION alert yet (DCF/Comps can't run unattended - see
 * research/finance/ValuationAlerts.md), so that filter would always be
 * empty and misleading.
 */
function AlertFilters({ active, unreadCount, onChange }) {
  const isActive = (value) => JSON.stringify(active) === JSON.stringify(value)

  const chip = (label, value, count) => (
    <button
      key={label}
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        isActive(value)
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-border bg-surface-raised text-ink-secondary hover:bg-surface-sunken'
      }`}
    >
      {label}
      {typeof count === 'number' && count > 0 ? ` (${count})` : ''}
    </button>
  )

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter alerts">
      {chip('All', {})}
      {chip('Unread', { unread: true }, unreadCount)}
      {TYPES.map((type) => chip(typeLabel(type), { type }))}
    </div>
  )
}

export default AlertFilters
