import { formatMarketCap, formatMetricValue } from '../../lib/industryFormat';

/**
 * "Potential Comparable Companies" - suggestions only (see
 * industry.peerDiscovery.js). Selecting "Use for Comparable Analysis"
 * pre-fills Sprint 7's user-controlled Comps peer picker; it never
 * calculates anything here and never becomes the Comps peer set on its own -
 * the user must still explicitly review/keep it and click Calculate on the
 * Comps tab.
 */
function PotentialPeersTable({ peers, onUseForComps }) {
  if (!peers || peers.length === 0) {
    return <p className="text-sm text-ink-muted">No potential peers were found in Athena&apos;s tracked companies for this reference universe.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Industry</th>
            <th className="px-3 py-2 text-right">Market Cap</th>
            <th className="px-3 py-2 text-right">Revenue Growth</th>
            <th className="px-3 py-2 text-right">Operating Margin</th>
            <th className="px-3 py-2 text-right">P/E</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {peers.map((peer) => (
            <tr key={peer.ticker} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="text-ink">{peer.name || peer.ticker}</span>{' '}
                <span className="text-xs text-ink-muted">({peer.ticker})</span>
              </td>
              <td className="px-3 py-2.5 text-ink-secondary">{peer.industry || peer.sector || '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                {formatMarketCap(peer.marketCap)}
                {peer.currency && peer.currency !== 'USD' && <span className="ml-1 text-xs text-ink-muted">{peer.currency}</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">{formatMetricValue(peer.revenueGrowth, 'percent')}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">{formatMetricValue(peer.operatingMargin, 'percent')}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">{formatMetricValue(peer.pe, 'multiple')}</td>
              <td className="px-3 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => onUseForComps(peer)}
                  className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:border-brand-500 hover:text-brand-600"
                >
                  Use for Comparable Analysis
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PotentialPeersTable;
