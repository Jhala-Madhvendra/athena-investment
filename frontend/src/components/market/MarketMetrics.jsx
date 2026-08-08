import StatCard from '../ui/StatCard';
import { formatValue } from '../../lib/statementTabs';

const formatPrice = (value) => (value === null || value === undefined ? '—' : value.toFixed(2));

const formatRatio = (value) => (value === null || value === undefined ? '—' : value.toFixed(2));

const formatPercent = (value) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(2)}%`;

/**
 * Current market snapshot as a stat-card grid. Every field is optional -
 * Yahoo doesn't guarantee valuation/dividend data for every ticker, so each
 * card falls back to "—" instead of the section breaking.
 */
function MarketMetrics({ quote }) {
  const currency = quote.currency || '';
  const { price = {}, valuation = {}, dividend = {} } = quote;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Current Price" value={formatPrice(price.current)} unit={currency} />
      <StatCard label="Market Capitalization" value={formatValue(price.marketCap)} unit={currency} />
      <StatCard label="Previous Close" value={formatPrice(price.previousClose)} unit={currency} />
      <StatCard label="Open" value={formatPrice(price.open)} unit={currency} />
      <StatCard label="Day High" value={formatPrice(price.dayHigh)} unit={currency} />
      <StatCard label="Day Low" value={formatPrice(price.dayLow)} unit={currency} />
      <StatCard label="52 Week High" value={formatPrice(price.fiftyTwoWeekHigh)} unit={currency} />
      <StatCard label="52 Week Low" value={formatPrice(price.fiftyTwoWeekLow)} unit={currency} />
      <StatCard label="Volume" value={formatValue(price.volume)} />
      <StatCard label="Average Volume" value={formatValue(price.averageVolume)} />
      <StatCard label="P/E Ratio" value={formatRatio(valuation.peRatio)} />
      <StatCard label="Forward P/E" value={formatRatio(valuation.forwardPE)} />
      <StatCard label="Price to Book" value={formatRatio(valuation.priceToBook)} />
      <StatCard label="EPS" value={formatPrice(valuation.eps)} unit={currency} />
      <StatCard label="Forward EPS" value={formatPrice(valuation.forwardEps)} unit={currency} />
      <StatCard label="Dividend Yield" value={formatPercent(dividend.yield)} />
    </div>
  );
}

export default MarketMetrics;
