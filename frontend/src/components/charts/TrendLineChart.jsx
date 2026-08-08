import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import ChartTooltip from './ChartTooltip';

/**
 * Generic multi-year line chart, reused for the revenue/net-income chart
 * (currency) and the margin chart (percent) via the series/valueFormatter props.
 * series: [{ key, label, color }]
 */
function TrendLineChart({ data, series, valueFormatter = (v) => v, showZeroLine = false, height = 280 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        Not enough data to chart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis
          dataKey="year"
          axisLine={{ stroke: '#c3c2b7' }}
          tickLine={false}
          tick={{ fill: '#898781', fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#898781', fontSize: 12 }}
          tickFormatter={valueFormatter}
          width={56}
        />
        {showZeroLine && <ReferenceLine y={0} stroke="#c3c2b7" strokeWidth={1} />}
        <Tooltip content={<ChartTooltip formatter={valueFormatter} />} cursor={{ stroke: '#c3c2b7', strokeWidth: 1 }} />
        {series.length > 1 && (
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: '#52514e' }}
          />
        )}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4, fill: s.color, strokeWidth: 2, stroke: '#fcfcfb' }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fcfcfb' }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default TrendLineChart;
