import { formatMoney, formatMultiple, formatPerShare, formatPercent } from '../../lib/compsFormat';

const MULTIPLES = [
  { key: 'pe', label: 'P/E' },
  { key: 'evEbitda', label: 'EV/EBITDA' },
  { key: 'evRevenue', label: 'EV/Revenue' },
  { key: 'pb', label: 'P/B' },
  { key: 'ps', label: 'P/S' },
];

/**
 * Primary Valuation Output: for each applicable multiple, the selected
 * peer statistic applied to the target's own metric, through to Implied
 * Value Per Share and the (labeled, non-recommendation) gap to the
 * current market price. Never picks or highlights a "best" multiple -
 * every applicable row is shown side by side.
 */
function ImpliedValuationTable({ impliedValuations, currency }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <th className="px-3 py-2">Multiple</th>
            <th className="px-3 py-2 text-right">Selected Statistic</th>
            <th className="px-3 py-2 text-right">Target Metric</th>
            <th className="px-3 py-2 text-right">Implied Equity Value</th>
            <th className="px-3 py-2 text-right">Implied Value / Share</th>
            <th className="px-3 py-2 text-right">Current Market Price</th>
            <th className="px-3 py-2 text-right">Implied Gap</th>
          </tr>
        </thead>
        <tbody>
          {MULTIPLES.map(({ key, label }) => {
            const valuation = impliedValuations?.[key];

            if (!valuation || !valuation.isApplicable) {
              return (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 font-medium text-ink">{label}</td>
                  <td colSpan={6} className="px-3 py-2.5 text-ink-muted italic">
                    Not applicable — {valuation?.reason || 'this multiple could not be computed.'}
                  </td>
                </tr>
              );
            }

            return (
              <tr key={key} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 font-medium text-ink">
                  {label}
                  <span className="ml-1.5 text-xs text-ink-muted">
                    ({valuation.basis === 'enterprise' ? 'Enterprise' : 'Equity'})
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                  {formatMultiple(valuation.selectedPeerStatistic)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                  {formatMoney(valuation.targetMetric, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                  {formatMoney(valuation.impliedEquityValue, currency)}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">
                  {formatPerShare(valuation.impliedValuePerShare, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                  {formatPerShare(valuation.currentMarketPrice, currency)}
                </td>
                <td
                  className="px-3 py-2.5 text-right tabular-nums font-medium"
                  style={{
                    color:
                      typeof valuation.upsideDownsidePercent !== 'number'
                        ? undefined
                        : valuation.upsideDownsidePercent >= 0
                          ? '#0ca30c'
                          : '#d03b3b',
                  }}
                >
                  {formatPercent(valuation.upsideDownsidePercent)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        Enterprise-basis multiples (EV/EBITDA, EV/Revenue) are bridged to Implied Equity Value via Enterprise Value −
        Net Debt before dividing by diluted shares. Equity-basis multiples (P/E, P/B, P/S) apply directly to equity
        value. The two are never interchanged.
      </p>
    </div>
  );
}

export default ImpliedValuationTable;
