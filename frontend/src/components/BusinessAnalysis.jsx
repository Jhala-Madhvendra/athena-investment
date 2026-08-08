import { useState, useEffect, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Tabs from './ui/Tabs';
import Meter from './ui/Meter';
import StatCard from './ui/StatCard';
import Skeleton from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';
import TrendLineChart from './charts/TrendLineChart';
import HealthScoreGauge from './charts/HealthScoreGauge';
import { getScoreTier } from '../lib/scoreTokens';
import { formatValue } from '../lib/statementTabs';

const TONE_HEX = { positive: '#0ca30c', negative: '#d03b3b', neutral: '#898781' };

const SUBTABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'details', label: 'Details' },
  { key: 'components', label: 'Components' },
];

/**
 * Business Analysis Tab
 * Displays financial health score, insights, growth metrics, and trends
 */
const BusinessAnalysis = ({ years = 5, weights = 'balanced' }) => {
  const { ticker, subtab } = useParams();
  const { financialStatements, currency } = useOutletContext();
  const activeSubtab = subtab || 'overview';

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Format percentage for display
   * @param {number} value - Decimal value (0.125 for 12.5%)
   * @returns {string} Formatted percentage string
   */
  const formatPercent = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (value === 'N/A' || value === 'infinite') return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  /**
   * Resolve a growth metric to display text + color class.
   * When CAGR isn't a real percentage (loss-to-profit or similar sign change),
   * falls back to the sign-change description instead of a bare "N/A".
   * @param {number|string|null} value - CAGR value (decimal), 'N/A', 'infinite', or null
   * @param {object|null} signChange - {label, positive} from the trends object
   * @param {boolean} invert - true when a falling value is the good outcome (e.g. debt)
   * @returns {{text: string, className: string}}
   */
  const renderGrowthValue = (value, signChange, invert = false) => {
    if (value === null || value === undefined || value === 'N/A' || value === 'infinite') {
      if (signChange) {
        const tone = signChange.positive === true ? 'positive' : signChange.positive === false ? 'negative' : 'neutral';
        return { text: signChange.label, className: `${tone} metric-value--label` };
      }
      return { text: 'N/A', className: 'neutral' };
    }
    const isGood = invert ? value <= 0 : value >= 0;
    return { text: formatPercent(value), className: isGood ? 'positive' : 'negative' };
  };

  /** Adapt a renderGrowthValue() result into StatCard props */
  const toStatCardProps = (display) => {
    const [tone] = display.className.split(' ');
    return {
      value: display.text,
      hex: TONE_HEX[tone] || TONE_HEX.neutral,
      small: display.className.includes('metric-value--label'),
    };
  };

  /**
   * Get emoji for trend direction
   * @param {string} direction - Direction indicator (↑, ↓, →, ⚠, ?)
   * @returns {string} Emoji representation
   */
  const getTrendEmoji = (direction) => {
    const map = {
      '↑': '📈',
      '↓': '📉',
      '→': '➡️',
      '⚠': '⚠️',
      '?': '❓'
    };
    return map[direction] || direction;
  };

  /**
   * Get plain-English label for trend direction
   * @param {string} direction - Direction indicator (↑, ↓, →, ⚠, ?)
   * @returns {string} Human-readable label
   */
  const getTrendLabel = (direction) => {
    const map = {
      '↑': 'Improving',
      '↓': 'Declining',
      '→': 'Stable',
      '⚠': 'Volatile',
      '?': 'Unknown'
    };
    return map[direction] || 'Unknown';
  };

  /**
   * Fetch analysis data from backend
   * (ticker is a required route param - React Router guarantees it's present)
   */
  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const queryParams = new URLSearchParams();
        queryParams.append('years', years);

        // Handle custom weights
        if (typeof weights === 'object') {
          queryParams.append('weights', JSON.stringify(weights));
        } else {
          queryParams.append('weights', weights);
        }

        const response = await fetch(
          `${apiBaseUrl}/api/analysis/${ticker}?${queryParams.toString()}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setAnalysis(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching analysis:', err);
        setError(err.message || 'Failed to load analysis. Please try again.');
        setAnalysis(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [ticker, years, weights]);

  /** Revenue + Net Income per-year series, derived from the statements the parent already fetched */
  const trendSeries = useMemo(() => {
    if (!analysis || !financialStatements || financialStatements.length === 0) return [];
    const sorted = [...financialStatements].sort((a, b) => a.year - b.year);
    const windowed = analysis.period?.numYears ? sorted.slice(-analysis.period.numYears) : sorted;
    return windowed.map((s) => ({
      year: s.year,
      revenue: s.incomeStatement?.totalRevenue ?? null,
      netIncome: s.incomeStatement?.netIncome ?? null,
    }));
  }, [analysis, financialStatements]);

  /** Operating/net margin per-year series - already computed server-side, just zipped by year */
  const marginSeries = useMemo(() => {
    if (!analysis) return [];
    const opValues = analysis.trends?.operatingMargin?.values || [];
    const opYears = analysis.trends?.operatingMargin?.years || [];
    const netValues = analysis.trends?.netMargin?.values || [];
    const netYears = analysis.trends?.netMargin?.years || [];

    const byYear = new Map();
    opYears.forEach((year, i) => {
      byYear.set(year, { year, operatingMargin: opValues[i] ?? null, netMargin: null });
    });
    netYears.forEach((year, i) => {
      const existing = byYear.get(year) || { year, operatingMargin: null, netMargin: null };
      existing.netMargin = netValues[i] ?? null;
      byYear.set(year, existing);
    });
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }, [analysis]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton variant="card" count={1} />
        <Skeleton variant="card" count={1} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Analysis error"
        message={`${error} Please ensure ${ticker} is a valid ticker and financial data is available.`}
      />
    );
  }

  if (!analysis) {
    return <EmptyState title="No analysis available" message="No analysis data available for this ticker." />;
  }

  const { healthScore, insights, growth, trends, period } = analysis;
  const scoreTier = getScoreTier(healthScore.overall);

  const revenueDisplay = renderGrowthValue(growth.revenueCAGR, trends.revenue?.signChange);
  const netIncomeDisplay = renderGrowthValue(growth.netIncomeCAGR, trends.netIncome?.signChange);
  const operatingIncomeDisplay = renderGrowthValue(growth.operatingIncomeCAGR, trends.operatingIncome?.signChange);
  const fcfDisplay = renderGrowthValue(growth.freeCashFlowCAGR, trends.cashFlow?.signChange);
  const debtGrowthDisplay = renderGrowthValue(growth.debtGrowth, trends.debtGrowth?.signChange, true);
  const equityGrowthDisplay = renderGrowthValue(growth.equityGrowth, trends.equityGrowth?.signChange);
  const assetGrowthDisplay = renderGrowthValue(growth.assetGrowth, trends.assetGrowth?.signChange);

  const trendItems = [
    { label: 'Operating Margin', trend: trends.operatingMargin },
    { label: 'Net Margin', trend: trends.netMargin },
    { label: 'Cash Flow', trend: trends.cashFlow },
    { label: 'ROE', trend: trends.roe },
    { label: 'Debt Growth', trend: trends.debtGrowth },
    { label: 'Equity Growth', trend: trends.equityGrowth },
    { label: 'Asset Growth', trend: trends.assetGrowth },
  ];

  const componentDefs = [
    { key: 'profitability', label: 'Profitability', description: 'Ability to generate profits from revenue', basis: 'Net Margin, ROE, ROA' },
    { key: 'liquidity', label: 'Liquidity', description: 'Ability to meet short-term obligations', basis: 'Current Ratio, Quick Ratio' },
    { key: 'solvency', label: 'Solvency', description: 'Ability to sustain debt levels long-term', basis: 'Debt-to-Equity, Debt-to-Assets' },
    { key: 'cashFlow', label: 'Cash Flow', description: 'Cash generation for operations and growth', basis: 'FCF CAGR, Operating CF' },
    { key: 'growth', label: 'Growth', description: 'Revenue and earnings expansion rate', basis: 'Revenue CAGR, Net Income CAGR' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Financial Analysis</h2>
        <p className="mt-1 text-sm text-slate-500">
          {period?.startYear && period?.endYear
            ? `${period.startYear} – ${period.endYear} (${period.numYears} years)`
            : 'Analysis period'}
        </p>
      </div>

      <Tabs
        items={SUBTABS.map((t) => ({
          key: t.key,
          label: t.label,
          to: `/financials/${ticker}/business-analysis/${t.key}`,
          end: true,
        }))}
      />

      {/* Overview */}
      {activeSubtab === 'overview' && (
        <div className="space-y-6">
          <Card title="Financial Health Score">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <HealthScoreGauge score={healthScore.overall} hex={scoreTier.hex} hexLight={scoreTier.hexLight} />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-slate-900">{healthScore.label}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Risk Level: <Badge tone={scoreTier.className}>{healthScore.riskLevel}</Badge>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{healthScore.explanation}</p>
              </div>
            </div>
          </Card>

          <Card title="Key Business Insights">
            <div className="space-y-3">
              {insights && insights.length > 0 ? (
                insights.map((insight, idx) => (
                  <div key={idx} className="rounded-lg border-l-4 border-brand-500 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone="brand">{insight.categoryLabel}</Badge>
                      <span className="text-xs font-medium text-slate-500">{insight.confidence}% confident</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-800">{insight.text}</p>
                    <p className="mt-2 text-xs text-slate-500 italic">💡 {insight.forward}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No insights available</p>
              )}
            </div>
          </Card>

          <Card title="Growth Metrics (CAGR)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Revenue CAGR" {...toStatCardProps(revenueDisplay)} trendEmoji={trends.revenue && getTrendEmoji(trends.revenue.direction)} />
              <StatCard label="Net Income CAGR" {...toStatCardProps(netIncomeDisplay)} trendEmoji={trends.netIncome && getTrendEmoji(trends.netIncome.direction)} />
              <StatCard label="Operating Income CAGR" {...toStatCardProps(operatingIncomeDisplay)} trendEmoji={trends.operatingIncome && getTrendEmoji(trends.operatingIncome.direction)} />
              <StatCard label="Free Cash Flow CAGR" {...toStatCardProps(fcfDisplay)} trendEmoji={trends.cashFlow && getTrendEmoji(trends.cashFlow.direction)} />
              <StatCard label="Debt Growth" {...toStatCardProps(debtGrowthDisplay)} trendEmoji={trends.debtGrowth && getTrendEmoji(trends.debtGrowth.direction)} />
              <StatCard label="Equity Growth" {...toStatCardProps(equityGrowthDisplay)} trendEmoji={trends.equityGrowth && getTrendEmoji(trends.equityGrowth.direction)} />
              <StatCard label="Asset Growth" {...toStatCardProps(assetGrowthDisplay)} trendEmoji={trends.assetGrowth && getTrendEmoji(trends.assetGrowth.direction)} />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Revenue & Net Income" eyebrow={currency ? `In ${currency}` : undefined}>
              <TrendLineChart
                data={trendSeries}
                series={[
                  { key: 'revenue', label: 'Revenue', color: '#2a78d6' },
                  { key: 'netIncome', label: 'Net Income', color: '#eb6834' },
                ]}
                valueFormatter={(v) => formatValue(v)}
                showZeroLine
              />
            </Card>
            <Card title="Margin Trend">
              <TrendLineChart
                data={marginSeries}
                series={[
                  { key: 'operatingMargin', label: 'Operating Margin', color: '#2a78d6' },
                  { key: 'netMargin', label: 'Net Margin', color: '#eb6834' },
                ]}
                valueFormatter={(v) => `${v}%`}
                showZeroLine
              />
            </Card>
          </div>

          <Card title="Trend Summary">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {trendItems.map(({ label, trend }) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  {trend && (
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <span aria-hidden="true">{getTrendEmoji(trend.direction)}</span>
                      {getTrendLabel(trend.direction)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Details */}
      {activeSubtab === 'details' && (
        <Card title="Detailed Business Insights">
          <div className="space-y-5">
            {insights && insights.length > 0 ? (
              insights.map((insight, idx) => (
                <div key={idx} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-base font-semibold text-slate-900">{insight.categoryLabel}</h4>
                    <div className="flex gap-2 text-xs font-medium text-slate-500">
                      <span>Confidence: {insight.confidence}%</span>
                      <span>·</span>
                      <span>Priority #{insight.priority}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{insight.text}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    <strong className="font-semibold text-slate-800">Why it matters:</strong> {insight.investorImportance}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <strong className="font-semibold text-slate-800">Looking ahead:</strong> {insight.forward}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No insights available</p>
            )}
          </div>
        </Card>
      )}

      {/* Components */}
      {activeSubtab === 'components' && (
        <Card title="Component Breakdown">
          <p className="text-sm text-slate-600">
            Financial Health Score is composed of five dimensions, each scored 0-100.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {componentDefs.map(({ key, label, description, basis }) => {
              const score = healthScore.components[key];
              const tier = getScoreTier(score);
              return (
                <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">{label}</h4>
                    <span className="text-lg font-bold tabular-nums" style={{ color: tier.hex }}>
                      {score}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{description}</p>
                  <Meter value={score} hex={tier.hex} hexLight={tier.hexLight} showValue={false} className="mt-3" />
                  <p className="mt-2 text-xs text-slate-400">Based on: {basis}</p>
                  <p className="mt-2 text-xs font-medium" style={{ color: tier.hex }}>
                    {score >= 75 ? '✓ Strong' : score >= 50 ? '→ Adequate' : '✗ Weak'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-800">Weighting Applied</h4>
            <div className="mt-3 space-y-3">
              {healthScore.weights && Object.entries(healthScore.weights).map(([component, weight]) => (
                <div key={component} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm capitalize text-slate-600">{component}</span>
                  <Meter value={weight * 100} hex="#2a78d6" hexLight="#cde2fb" showValue={false} />
                  <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">
                    {(weight * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 pt-4 text-center">
        <p className="text-xs text-slate-400">Calculated: {new Date(analysis.calculatedAt).toLocaleString()}</p>
        <p className="mt-1 text-xs text-slate-400">
          This analysis is for informational purposes only and should not be considered investment advice.
        </p>
      </div>
    </div>
  );
};

export default BusinessAnalysis;
