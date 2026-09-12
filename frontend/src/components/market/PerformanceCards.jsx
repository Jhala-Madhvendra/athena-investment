import StatCard from '../ui/StatCard';

const TONE_HEX = { positive: '#0ca30c', negative: '#d03b3b', neutral: '#898781' };

const PERIOD_ORDER = ['1M', '3M', '6M', '1Y', '5Y', '10Y'];

const formatReturn = (value) => {
  if (value === null || value === undefined) return { text: 'N/A', hex: TONE_HEX.neutral };
  const sign = value > 0 ? '+' : '';
  const hex = value > 0 ? TONE_HEX.positive : value < 0 ? TONE_HEX.negative : TONE_HEX.neutral;
  return { text: `${sign}${value.toFixed(2)}%`, hex };
};

/** Row of 1M/3M/6M/1Y/5Y/10Y stock-return stat cards, colored by sign. */
function PerformanceCards({ performance }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {PERIOD_ORDER.map((period) => {
        const { text, hex } = formatReturn(performance?.[period]);
        return <StatCard key={period} label={`${period} Return`} value={text} hex={hex} />;
      })}
    </div>
  );
}

export default PerformanceCards;
