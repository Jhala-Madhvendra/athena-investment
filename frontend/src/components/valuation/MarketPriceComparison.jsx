import StatCard from '../ui/StatCard';

const formatPrice = (value, currency) =>
  typeof value === 'number' ? `${value.toFixed(2)}${currency ? ` ${currency}` : ''}` : '—';

const formatGap = (value) => (typeof value === 'number' ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '—');

/**
 * Step 12 (Upside/Downside): presented as a "valuation gap," deliberately
 * never as a Buy/Sell/Strong Buy/Strong Sell recommendation - Athena is an
 * analytical tool, not a financial adviser. The disclaimer is rendered
 * alongside the numbers every time, not tucked away in a footnote.
 */
function MarketPriceComparison({ currentMarketPrice, intrinsicValuePerShare, upsideDownsidePercent, currency, disclaimer }) {
  const gapKnown = typeof upsideDownsidePercent === 'number';
  const gapHex = !gapKnown ? '#898781' : upsideDownsidePercent >= 0 ? '#0ca30c' : '#d03b3b';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Current Market Price" value={formatPrice(currentMarketPrice, currency)} />
        <StatCard label="Intrinsic Value / Share" value={formatPrice(intrinsicValuePerShare, currency)} />
        <StatCard label="Valuation Gap" value={formatGap(upsideDownsidePercent)} hex={gapHex} />
      </div>

      {!gapKnown && (
        <p className="text-xs text-ink-muted">
          A live market price isn&apos;t available for this ticker, so the valuation gap can&apos;t be computed.
        </p>
      )}

      <div className="rounded-lg border border-warning/30 bg-warning-light/40 p-4">
        <p className="text-xs leading-relaxed text-ink-secondary">{disclaimer}</p>
      </div>
    </div>
  );
}

export default MarketPriceComparison;
