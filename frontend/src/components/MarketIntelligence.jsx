import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Card from './ui/Card';
import Skeleton from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';
import PriceHistoryChart from './charts/PriceHistoryChart';
import MarketMetrics from './market/MarketMetrics';
import PerformanceCards from './market/PerformanceCards';
import BusinessVsMarketPerformance from './market/BusinessVsMarketPerformance';

const CHART_PERIODS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
  { key: '10y', label: '10Y' },
];

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const fetchJson = async (url, signal) => {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }
  return data;
};

/**
 * Market Intelligence tab: current snapshot, historical chart, performance
 * returns, and a business-vs-market comparison. Mirrors BusinessAnalysis.jsx's
 * fetch/loading/error pattern, split across independent effects since the
 * market snapshot, price history, and business-comparison data have
 * different refresh triggers (ticker vs. ticker+period).
 */
function MarketIntelligence() {
  const { ticker } = useParams();

  const [quote, setQuote] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState('');

  const [period, setPeriod] = useState('1y');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const [growth, setGrowth] = useState(null);
  const [ratios, setRatios] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadMarketData = async () => {
      setMarketLoading(true);
      setMarketError('');

      try {
        const [quoteData, performanceData] = await Promise.all([
          fetchJson(`${apiBaseUrl}/api/market/${encodeURIComponent(ticker)}`, controller.signal),
          fetchJson(`${apiBaseUrl}/api/market/${encodeURIComponent(ticker)}/performance`, controller.signal),
        ]);

        setQuote(quoteData);
        setPerformance(performanceData.performance);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setMarketError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setMarketLoading(false);
        }
      }
    };

    loadMarketData();
    return () => controller.abort();
  }, [ticker]);

  useEffect(() => {
    const controller = new AbortController();

    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError('');

      try {
        const data = await fetchJson(
          `${apiBaseUrl}/api/market/${encodeURIComponent(ticker)}/history?period=${period}`,
          controller.signal
        );
        setHistory(data.data || []);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setHistoryError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();
    return () => controller.abort();
  }, [ticker, period]);

  useEffect(() => {
    const controller = new AbortController();

    const loadComparisonData = async () => {
      try {
        const [analysisData, ratiosData] = await Promise.all([
          fetchJson(`${apiBaseUrl}/api/analysis/${encodeURIComponent(ticker)}`, controller.signal),
          fetchJson(`${apiBaseUrl}/api/ratios/${encodeURIComponent(ticker)}`, controller.signal),
        ]);
        setGrowth(analysisData.growth || null);
        setRatios(ratiosData.ratios || null);
      } catch (requestError) {
        // Business-vs-market comparison is supplementary; leave it blank rather
        // than failing the whole Market Intelligence tab if it errors.
        if (requestError.name !== 'AbortError') {
          setGrowth(null);
          setRatios(null);
        }
      }
    };

    loadComparisonData();
    return () => controller.abort();
  }, [ticker]);

  if (marketLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton variant="card" count={1} />
        <Skeleton variant="card" count={1} />
      </div>
    );
  }

  if (marketError) {
    return (
      <ErrorState
        title="Couldn't load market data"
        message={`${marketError} Please ensure ${ticker} is a valid ticker.`}
      />
    );
  }

  if (!quote) {
    return <EmptyState title="No market data available" message={`No market data is available for ${ticker}.`} />;
  }

  const valueFormatter = (value) => (typeof value === 'number' ? value.toFixed(0) : value);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">Market Intelligence</h2>
        <p className="mt-1 text-sm text-ink-muted">
          How the market is currently pricing {ticker?.toUpperCase()}. Figures are informational only and are not
          investment recommendations.
        </p>
      </div>

      <Card title="Market Snapshot">
        <MarketMetrics quote={quote} />
      </Card>

      <Card title="Performance">
        <PerformanceCards performance={performance} />
      </Card>

      <Card title="Historical Price">
        <PriceHistoryChart
          data={history}
          loading={historyLoading}
          error={historyError}
          period={period}
          periods={CHART_PERIODS}
          onPeriodChange={setPeriod}
          valueFormatter={valueFormatter}
        />
      </Card>

      <Card title="Business vs. Market Performance">
        <BusinessVsMarketPerformance growth={growth} ratios={ratios} performance={performance} quote={quote} />
      </Card>
    </div>
  );
}

export default MarketIntelligence;
