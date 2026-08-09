import { useEffect, useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import Card from './ui/Card';
import Badge from './ui/Badge';
import StatCard from './ui/StatCard';
import Skeleton from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';
import SectionHeader from './ui/SectionHeader';
import CompanyHeader from './dashboard/CompanyHeader';
import HealthScoreCard from './dashboard/HealthScoreCard';
import BusinessPerformanceRow from './dashboard/BusinessPerformanceRow';
import InsightCard from './dashboard/InsightCard';
import PerformanceCards from './market/PerformanceCards';
import { formatValue } from '../lib/statementTabs';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const fetchJson = async (url, signal) => {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Request failed.');
  }
  return data;
};

const formatCagr = (value) => (typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '—');
const formatPercentScale = (value) => (typeof value === 'number' ? `${value.toFixed(2)}%` : '—');
const formatRatio = (value) => (typeof value === 'number' ? value.toFixed(2) : '—');

/**
 * Simple, threshold-based observations derived from already-fetched market
 * data - descriptive only (never "overvalued/cheap/buy/sell"), distinct from
 * the backend insight engine's statistical trend analysis. Fills the "Market
 * Intelligence Engine" source Key Insights is meant to aggregate from, since
 * no dedicated market-insight engine exists yet.
 */
const deriveMarketObservations = (quote, performance) => {
  const observations = [];
  const current = quote?.price?.current;
  const high = quote?.price?.fiftyTwoWeekHigh;
  const low = quote?.price?.fiftyTwoWeekLow;
  const currency = quote?.currency || '';

  if (typeof current === 'number' && typeof high === 'number' && current >= high * 0.98) {
    observations.push({
      categoryLabel: 'Market Position',
      text: `Trading near its 52-week high of ${high.toFixed(2)} ${currency}.`.trim(),
      confidence: null,
    });
  } else if (typeof current === 'number' && typeof low === 'number' && current <= low * 1.02) {
    observations.push({
      categoryLabel: 'Market Position',
      text: `Trading near its 52-week low of ${low.toFixed(2)} ${currency}.`.trim(),
      confidence: null,
    });
  }

  const oneYearReturn = performance?.['1Y'];
  if (typeof oneYearReturn === 'number' && Math.abs(oneYearReturn) >= 30) {
    observations.push({
      categoryLabel: 'Market Position',
      text: `The stock has moved ${oneYearReturn > 0 ? 'up' : 'down'} ${Math.abs(oneYearReturn).toFixed(1)}% over the past year.`,
      confidence: null,
    });
  }

  return observations;
};

/** Small hook-like helper: fetch one endpoint into its own {data, loading, error} slot. */
const useFetchSlot = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  return { data, setData, loading, setLoading, error, setError };
};

function Overview() {
  const { ticker } = useParams();
  const { financialStatements } = useOutletContext();

  const company = useFetchSlot();
  const quote = useFetchSlot();
  const performance = useFetchSlot();
  const analysis = useFetchSlot();
  const ratios = useFetchSlot();

  useEffect(() => {
    const controller = new AbortController();

    const load = async (url, slot, unwrap = (d) => d) => {
      slot.setLoading(true);
      slot.setError('');
      try {
        const data = await fetchJson(url, controller.signal);
        slot.setData(unwrap(data));
      } catch (err) {
        if (err.name !== 'AbortError') {
          slot.setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          slot.setLoading(false);
        }
      }
    };

    load(`${apiBaseUrl}/api/company/${encodeURIComponent(ticker)}`, company, (d) => d.company);
    load(`${apiBaseUrl}/api/market/${encodeURIComponent(ticker)}`, quote);
    load(`${apiBaseUrl}/api/market/${encodeURIComponent(ticker)}/performance`, performance, (d) => d.performance);
    load(`${apiBaseUrl}/api/analysis/${encodeURIComponent(ticker)}`, analysis);
    load(`${apiBaseUrl}/api/ratios/${encodeURIComponent(ticker)}`, ratios, (d) => d.ratios);

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const latestStatement = financialStatements?.[0] || null;
  const marketObservations = deriveMarketObservations(quote.data, performance.data);
  const allInsights = [...(analysis.data?.insights || []), ...marketObservations];

  return (
    <div className="space-y-8">
      {/* Company Header */}
      {company.loading && <Skeleton variant="card" count={1} />}
      {!company.loading && company.error && (
        <ErrorState title="Couldn't load company profile" message={company.error} />
      )}
      {!company.loading && !company.error && company.data && (
        <CompanyHeader
          company={company.data}
          quote={quote.data}
          quoteLoading={quote.loading}
          quoteError={quote.error}
        />
      )}

      {/* Financial Health */}
      <Card
        title="Financial Health"
        action={
          <Link to={`/financials/${ticker}/business-analysis/overview`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View full breakdown →
          </Link>
        }
      >
        {analysis.loading && <Skeleton variant="card" count={1} />}
        {!analysis.loading && analysis.error && (
          <ErrorState title="Couldn't load financial health" message={analysis.error} />
        )}
        {!analysis.loading && !analysis.error && analysis.data?.healthScore && (
          <div className="space-y-5">
            <HealthScoreCard healthScore={analysis.data.healthScore} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Revenue CAGR" value={formatCagr(analysis.data.growth?.revenueCAGR)} />
              <StatCard label="Net Income CAGR" value={formatCagr(analysis.data.growth?.netIncomeCAGR)} />
              <StatCard label="ROE" value={formatPercentScale(ratios.data?.profitability?.returnOnEquity?.value)} />
              <StatCard label="Net Margin" value={formatPercentScale(ratios.data?.profitability?.netProfitMargin?.value)} />
              <StatCard label="Free Cash Flow" value={ratios.data?.cashFlow?.freeCashFlow?.value != null ? formatValue(ratios.data.cashFlow.freeCashFlow.value) : '—'} />
              <StatCard label="Debt-to-Equity" value={formatRatio(ratios.data?.solvency?.debtToEquity?.value)} />
            </div>
          </div>
        )}
      </Card>

      {/* Business Performance */}
      <Card title="Business Performance">
        {analysis.loading && <Skeleton variant="card" count={1} />}
        {!analysis.loading && analysis.error && (
          <ErrorState title="Couldn't load business performance" message={analysis.error} />
        )}
        {!analysis.loading && !analysis.error && analysis.data && (
          <div>
            <BusinessPerformanceRow
              label="Revenue"
              value={latestStatement?.incomeStatement?.totalRevenue != null ? formatValue(latestStatement.incomeStatement.totalRevenue) : '—'}
              direction={analysis.data.trends?.revenue?.direction}
              insightText={allInsights.find((i) => i.category === 'revenueGrowth')?.text}
            />
            <BusinessPerformanceRow
              label="Profit"
              value={latestStatement?.incomeStatement?.netIncome != null ? formatValue(latestStatement.incomeStatement.netIncome) : '—'}
              direction={analysis.data.trends?.netIncome?.direction}
            />
            <BusinessPerformanceRow
              label="Operating Margin"
              value={formatPercentScale(ratios.data?.profitability?.operatingMargin?.value)}
              direction={analysis.data.trends?.operatingMargin?.direction}
              insightText={allInsights.find((i) => i.category === 'profitMargin')?.text}
            />
            <BusinessPerformanceRow
              label="Free Cash Flow"
              value={ratios.data?.cashFlow?.freeCashFlow?.value != null ? formatValue(ratios.data.cashFlow.freeCashFlow.value) : '—'}
              direction={analysis.data.trends?.cashFlow?.direction}
              insightText={allInsights.find((i) => i.category === 'cashFlow')?.text}
            />
            <BusinessPerformanceRow
              label="Debt"
              value={latestStatement?.balanceSheet?.totalDebt != null ? formatValue(latestStatement.balanceSheet.totalDebt) : '—'}
              direction={analysis.data.trends?.debtGrowth?.direction}
              invert
              insightText={allInsights.find((i) => i.category === 'debtPosition')?.text}
            />
          </div>
        )}
      </Card>

      {/* Market Performance */}
      <Card
        title="Market Performance"
        action={
          <Link to={`/financials/${ticker}/market-intelligence`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View details →
          </Link>
        }
      >
        {quote.loading && performance.loading && <Skeleton variant="card" count={1} />}
        {!quote.loading && !performance.loading && quote.error && performance.error && (
          <ErrorState title="Couldn't load market performance" message={quote.error} />
        )}
        {(!quote.loading || !performance.loading) && !(quote.error && performance.error) && (
          <div className="space-y-5">
            <PerformanceCards performance={performance.data} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="P/E Ratio" value={formatRatio(quote.data?.valuation?.peRatio)} />
              <StatCard label="P/B Ratio" value={formatRatio(quote.data?.valuation?.priceToBook)} />
              <StatCard
                label="52-Week Range"
                small
                value={
                  quote.data?.price?.fiftyTwoWeekLow != null && quote.data?.price?.fiftyTwoWeekHigh != null
                    ? `${quote.data.price.fiftyTwoWeekLow.toFixed(2)} – ${quote.data.price.fiftyTwoWeekHigh.toFixed(2)}`
                    : '—'
                }
                unit={quote.data?.currency}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Key Insights */}
      <Card title="Key Insights">
        {analysis.loading && <Skeleton variant="card" count={1} />}
        {!analysis.loading && analysis.error && (
          <ErrorState title="Couldn't load insights" message={analysis.error} />
        )}
        {!analysis.loading && !analysis.error && (
          allInsights.length > 0 ? (
            <div className="space-y-3">
              {allInsights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} />
              ))}
            </div>
          ) : (
            <EmptyState title="No notable insights" message="Not enough data yet to generate insights for this company." />
          )
        )}
      </Card>

      {/* Explore further */}
      <div className="border-t border-border pt-6">
        <SectionHeader title="Explore further" description="Drill into the full data behind this summary." />
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={`/financials/${ticker}/financial-statements`}>
            <Badge tone="brand">Financial Statements →</Badge>
          </Link>
          <Link to={`/financials/${ticker}/financial-analysis`}>
            <Badge tone="brand">Financial Analysis →</Badge>
          </Link>
          <Link to={`/financials/${ticker}/business-analysis/overview`}>
            <Badge tone="brand">Business Analysis →</Badge>
          </Link>
          <Link to={`/financials/${ticker}/market-intelligence`}>
            <Badge tone="brand">Market Intelligence →</Badge>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Overview;
