import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartTooltip from './ChartTooltip';
import Skeleton from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';

const formatAxisDate = (dateString, period) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;

  if (period === '1m' || period === '3m') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};

/**
 * Generic reusable price/time-series chart: date-keyed area chart with a
 * period selector, tooltip, and loading/empty/error states. Not coupled to
 * "market data" specifically - any {date, value} series can drive it.
 */
function PriceHistoryChart({
  data,
  loading,
  error,
  period,
  periods = [],
  onPeriodChange,
  valueFormatter = (v) => v,
  height = 320,
}) {
  const chartData = (data || []).map((point) => ({ date: point.date, value: point.close ?? point.value }));

  return (
    <div>
      {periods.length > 0 && (
        <div role="tablist" aria-label="Chart period" className="mb-4 flex gap-1">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => onPeriodChange?.(p.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.key
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {loading && <Skeleton variant="card" count={1} className="h-80" />}

      {!loading && error && <ErrorState title="Couldn't load price history" message={error} />}

      {!loading && !error && chartData.length === 0 && (
        <EmptyState title="No price history available" message="Historical prices could not be found for this period." />
      )}

      {!loading && !error && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceHistoryFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2a78d6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e1e0d9" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatAxisDate(value, period)}
              axisLine={{ stroke: '#c3c2b7' }}
              tickLine={false}
              tick={{ fill: '#898781', fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={['auto', 'auto']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#898781', fontSize: 12 }}
              tickFormatter={valueFormatter}
              width={64}
            />
            <Tooltip
              content={<ChartTooltip formatter={valueFormatter} />}
              labelFormatter={(value) => formatAxisDate(value, period)}
              cursor={{ stroke: '#c3c2b7', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name="Price"
              stroke="#2a78d6"
              strokeWidth={2}
              fill="url(#priceHistoryFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fcfcfb' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default PriceHistoryChart;
