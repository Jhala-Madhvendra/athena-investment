import StatCard from '../ui/StatCard';
import { formatValue } from '../../lib/statementTabs';

/** Steps 7-11: PV of FCFF -> Terminal Value -> Enterprise Value -> Equity Value -> Intrinsic Value / Share. */
function DCFSummary({ result }) {
  if (!result) {
    return null;
  }

  const { pvOfFCFF, terminalValue, pvOfTerminalValue, enterpriseValue, netDebt, equityValue, intrinsicValuePerShare, capitalStructure } =
    result;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="PV of Forecast FCFF" value={formatValue(pvOfFCFF)} />
        <StatCard label="Terminal Value" value={formatValue(terminalValue)} />
        <StatCard label="PV of Terminal Value" value={formatValue(pvOfTerminalValue)} />
        <StatCard label="Enterprise Value" value={formatValue(enterpriseValue)} hex="#2a78d6" />
        <StatCard
          label="Net Debt"
          value={formatValue(netDebt)}
          sublabel={typeof netDebt === 'number' && netDebt < 0 ? 'Net cash position' : 'Debt − Cash'}
        />
        <StatCard label="Equity Value" value={formatValue(equityValue)} hex="#2a78d6" />
      </div>

      <div className="rounded-lg border border-brand-100 bg-brand-50 p-5 text-center">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Intrinsic Value Per Share</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-brand-800">
          {typeof intrinsicValuePerShare === 'number' ? intrinsicValuePerShare.toFixed(2) : '—'}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Equity Value ÷ {formatValue(capitalStructure?.dilutedShares)} diluted shares outstanding
        </p>
      </div>
    </div>
  );
}

export default DCFSummary;
