import StatCard from '../ui/StatCard';
import { formatValue } from '../../lib/statementTabs';

const formatPercent = (value) => (typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '—');

/** Steps 3-6 (WACC, CAPM, Cost of Debt, Capital Structure) collapsed into the computed breakdown. */
function WACCBreakdown({ waccBreakdown }) {
  if (!waccBreakdown) {
    return null;
  }

  const { costOfEquity, afterTaxCostOfDebt, marketValueOfEquity, marketValueOfDebt, wacc } = waccBreakdown;
  const totalCapital = (marketValueOfEquity || 0) + (marketValueOfDebt || 0);
  const equityWeight = totalCapital > 0 ? marketValueOfEquity / totalCapital : null;
  const debtWeight = totalCapital > 0 ? marketValueOfDebt / totalCapital : null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Cost of Equity (CAPM)" value={formatPercent(costOfEquity)} />
        <StatCard label="After-Tax Cost of Debt" value={formatPercent(afterTaxCostOfDebt)} />
        <StatCard label="WACC" value={formatPercent(wacc)} hex="#2a78d6" />
        <StatCard
          label="Market Value of Equity"
          value={formatValue(marketValueOfEquity)}
          sublabel={equityWeight !== null ? `${(equityWeight * 100).toFixed(0)}% of capital` : undefined}
        />
        <StatCard
          label="Market Value of Debt"
          value={formatValue(marketValueOfDebt)}
          sublabel={debtWeight !== null ? `${(debtWeight * 100).toFixed(0)}% of capital` : undefined}
        />
      </div>
      <p className="mt-4 text-xs text-ink-muted">
        WACC = (E ÷ (D+E)) × Cost of Equity + (D ÷ (D+E)) × After-Tax Cost of Debt. Equity is weighted at market
        capitalization, matching how the market actually prices the company today; debt uses book value as a proxy
        since no bond-pricing data is available.
      </p>
    </div>
  );
}

export default WACCBreakdown;
