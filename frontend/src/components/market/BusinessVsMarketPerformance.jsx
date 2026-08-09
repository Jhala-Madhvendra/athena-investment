import Card from '../ui/Card';
import { formatValue } from '../../lib/statementTabs';

const formatCagr = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '—');
const formatPercentScale = (value) => (value === null || value === undefined ? '—' : `${value.toFixed(2)}%`);
const formatSignedPercent = (value) =>
  value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const formatRatio = (value) => (value === null || value === undefined ? '—' : value.toFixed(2));

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
    <span className="text-sm text-ink-secondary">{label}</span>
    <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
  </div>
);

/**
 * Side-by-side comparison of business fundamentals vs. market pricing.
 * Presents figures only - no "cheap/expensive/buy/sell" framing.
 */
function BusinessVsMarketPerformance({ growth, ratios, performance, quote }) {
  const roe = ratios?.profitability?.returnOnEquity?.value ?? null;
  const operatingMargin = ratios?.profitability?.operatingMargin?.value ?? null;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-secondary">
        Business performance measures how the company itself is doing (revenue growth, profitability, cash
        generation). Market performance measures how investors are currently pricing the company's shares. The two
        don't always move together - a strong business can trade at a low valuation, and a weaker business can trade
        at a high one. This section presents both side by side without judging whether the current price is
        justified.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Business Performance" eyebrow="How the company is doing">
          <Row label="Revenue CAGR" value={formatCagr(growth?.revenueCAGR)} />
          <Row label="Net Income CAGR" value={formatCagr(growth?.netIncomeCAGR)} />
          <Row label="Free Cash Flow CAGR" value={formatCagr(growth?.freeCashFlowCAGR)} />
          <Row label="Return on Equity (ROE)" value={formatPercentScale(roe)} />
          <Row label="Operating Margin" value={formatPercentScale(operatingMargin)} />
        </Card>

        <Card title="Market Performance" eyebrow="How the stock is priced">
          <Row label="1 Year Stock Return" value={formatSignedPercent(performance?.['1Y'])} />
          <Row label="P/E Ratio" value={formatRatio(quote?.valuation?.peRatio)} />
          <Row label="Price to Book" value={formatRatio(quote?.valuation?.priceToBook)} />
          <Row label="Market Capitalization" value={formatValue(quote?.price?.marketCap)} />
        </Card>
      </div>
    </div>
  );
}

export default BusinessVsMarketPerformance;
