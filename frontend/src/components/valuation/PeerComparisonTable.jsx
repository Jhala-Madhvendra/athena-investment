import { formatMoney, formatMultiple } from '../../lib/compsFormat';

const COLUMNS = [
  { key: 'marketCap', label: 'Market Cap', type: 'money' },
  { key: 'enterpriseValue', label: 'Enterprise Value', type: 'money' },
  { key: 'revenue', label: 'Revenue', type: 'money' },
  { key: 'ebitda', label: 'EBITDA', type: 'money' },
  { key: 'netIncome', label: 'Net Income', type: 'money' },
  { key: 'bookValue', label: 'Book Value', type: 'money' },
];

const MULTIPLE_COLUMNS = [
  { key: 'pe', label: 'P/E' },
  { key: 'evEbitda', label: 'EV/EBITDA' },
  { key: 'evRevenue', label: 'EV/Revenue' },
  { key: 'pb', label: 'P/B' },
  { key: 'ps', label: 'P/S' },
];

/**
 * Horizontally-scrollable comparison table: target + peers as rows,
 * financial metrics and trading multiples as columns. Missing data is
 * rendered as "—" (never a misleading zero), with the specific exclusion
 * reason available on hover via `title` - see comps.engine.js for how
 * those reasons are derived.
 */
function PeerComparisonTable({ target, peers, currency }) {
  const rows = [
    { ...target, isTarget: true },
    ...peers.map((peer) => ({ ...peer, isTarget: false })),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <th className="sticky left-0 bg-surface-raised px-3 py-2">Company</th>
            {COLUMNS.map((column) => (
              <th key={column.key} className="px-3 py-2 text-right whitespace-nowrap">
                {column.label}
              </th>
            ))}
            {MULTIPLE_COLUMNS.map((column) => (
              <th key={column.key} className="px-3 py-2 text-right whitespace-nowrap">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.ticker}
              className={`border-b border-border last:border-0 ${row.isTarget ? 'bg-brand-500/5 font-medium' : ''}`}
            >
              <td
                className={`sticky left-0 px-3 py-2.5 whitespace-nowrap ${row.isTarget ? 'bg-brand-50' : 'bg-surface-raised'}`}
              >
                <span className="text-ink">{row.name || row.ticker}</span>{' '}
                <span className="text-xs text-ink-muted">({row.ticker})</span>
                {row.isTarget && (
                  <span className="ml-1.5 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-700 uppercase">
                    Target
                  </span>
                )}
              </td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                  {formatMoney(row[column.key], currency)}
                </td>
              ))}
              {MULTIPLE_COLUMNS.map((column) => {
                const multiple = row.multiples?.[column.key];
                return (
                  <td
                    key={column.key}
                    className="px-3 py-2.5 text-right tabular-nums text-ink-secondary"
                    title={multiple?.excludedReason || undefined}
                  >
                    {formatMultiple(multiple?.value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PeerComparisonTable;
