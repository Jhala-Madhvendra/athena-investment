import { formatMultiple } from '../../lib/compsFormat';

const MULTIPLES = [
  { key: 'pe', label: 'P/E' },
  { key: 'evEbitda', label: 'EV/EBITDA' },
  { key: 'evRevenue', label: 'EV/Revenue' },
  { key: 'pb', label: 'P/B' },
  { key: 'ps', label: 'P/S' },
];

const STAT_COLUMNS = [
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
  { key: 'mean', label: 'Mean' },
  { key: 'median', label: 'Median' },
  { key: 'p25', label: 'P25' },
  { key: 'p75', label: 'P75' },
];

/**
 * Peer statistics per multiple, with the currently-selected statistic
 * column highlighted, and each multiple's excluded peers listed with the
 * specific reason - percentiles show "—" (not a fabricated number) when
 * fewer than 4 peers had a valid observation, per comps.statistics.js.
 */
function PeerStatisticsTable({ peerStatistics, statistic }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <th className="px-3 py-2">Multiple</th>
            <th className="px-3 py-2 text-right">Valid Peers</th>
            {STAT_COLUMNS.map((column) => (
              <th
                key={column.key}
                className={`px-3 py-2 text-right ${column.key === statistic ? 'text-brand-600' : ''}`}
              >
                {column.label}
                {column.key === statistic ? ' ★' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MULTIPLES.map(({ key, label }) => {
            const summary = peerStatistics?.[key];

            return (
              <tr key={key} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2.5 font-medium text-ink">{label}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">{summary?.count ?? 0}</td>
                {STAT_COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-2.5 text-right tabular-nums ${
                      column.key === statistic ? 'bg-brand-500/5 font-semibold text-brand-700' : 'text-ink-secondary'
                    }`}
                  >
                    {formatMultiple(summary?.[column.key])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {MULTIPLES.some(({ key }) => (peerStatistics?.[key]?.excludedPeers || []).length > 0) && (
        <div className="mt-3 space-y-1 text-xs text-ink-muted">
          {MULTIPLES.map(({ key, label }) => {
            const excluded = peerStatistics?.[key]?.excludedPeers || [];
            if (excluded.length === 0) return null;
            return (
              <p key={key}>
                <span className="font-semibold text-ink-secondary">{label} excluded:</span>{' '}
                {excluded.map((peer) => `${peer.ticker} (${peer.reason})`).join('; ')}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PeerStatisticsTable;
