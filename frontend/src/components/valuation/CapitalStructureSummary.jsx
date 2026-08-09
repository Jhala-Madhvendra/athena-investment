import SourceBadge from './SourceBadge';
import { formatValue } from '../../lib/statementTabs';

function LabeledStat({ label, entry }) {
  return (
    <div className="rounded-lg border border-border bg-surface-sunken p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
        <SourceBadge source={entry?.source} />
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-ink">
        {typeof entry?.value === 'number' ? formatValue(entry.value) : '—'}
      </p>
    </div>
  );
}

/** Step 6 (Capital Structure): the objective, non-editable inputs the DCF pulls from stored/live data. */
function CapitalStructureSummary({ capitalStructure }) {
  if (!capitalStructure) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <LabeledStat label="Total Debt" entry={capitalStructure.debt} />
      <LabeledStat label="Cash & Equivalents" entry={capitalStructure.cash} />
      <LabeledStat label="Diluted Shares Outstanding" entry={capitalStructure.dilutedShares} />
      <LabeledStat label="Market Value of Equity" entry={capitalStructure.marketValueOfEquity} />
    </div>
  );
}

export default CapitalStructureSummary;
