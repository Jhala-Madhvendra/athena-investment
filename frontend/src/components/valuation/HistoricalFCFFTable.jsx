import { formatValue } from '../../lib/statementTabs';

const formatPercent = (value) => (typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—');

/**
 * Step 1 (Historical FCFF): renders dcf.engine.js's calculateHistoricalFCFF
 * output. The earliest year is always `available: false` (no prior-year
 * balance sheet to diff for Change in NWC) - shown as "N/A", never
 * silently dropped or zeroed.
 */
function HistoricalFCFFTable({ historicalFCFF }) {
  if (!historicalFCFF || historicalFCFF.length === 0) {
    return <p className="text-sm text-ink-muted">No historical financial data available.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-sunken">
              <th scope="col" className="px-4 py-2.5 text-left font-semibold text-ink-secondary">
                Fiscal Year
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-ink-secondary">
                EBIT
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-ink-secondary">
                Effective Tax Rate
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-ink-secondary">
                D&amp;A
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-ink-secondary">
                CapEx
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-ink-secondary">
                Change in NWC
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-ink-secondary">
                FCFF
              </th>
            </tr>
          </thead>
          <tbody>
            {historicalFCFF.map((row) => (
              <tr key={row.year} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink-secondary">
                  FY {row.year}
                </th>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">{formatValue(row.ebit)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">{formatPercent(row.taxRate)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                  {formatValue(row.depreciationAndAmortization)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">{formatValue(row.capitalExpenditure)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">{formatValue(row.changeInNWC)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink">
                  {row.available ? formatValue(row.fcff) : <span className="font-normal text-ink-muted">N/A</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        FCFF = EBIT × (1 − Tax Rate) + D&amp;A − CapEx − Change in NWC. The earliest year has no prior-year balance
        sheet to compare against, so its Change in NWC and FCFF aren&apos;t available.
      </p>
    </div>
  );
}

export default HistoricalFCFFTable;
