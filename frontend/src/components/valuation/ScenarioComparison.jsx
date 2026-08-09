import Badge from '../ui/Badge';

const SCENARIO_META = {
    bear: { label: 'Bear Case', tone: 'critical' },
    base: { label: 'Base Case', tone: 'brand' },
    bull: { label: 'Bull Case', tone: 'good' },
};

const formatPrice = (value) => (typeof value === 'number' ? value.toFixed(2) : '—');
const formatDeltaPP = (value) =>
    typeof value === 'number' ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}pp` : '—';
const formatGap = (value) => (typeof value === 'number' ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '—');

/** Scenario Analysis: Bear/Base/Bull side by side. Only revenue growth and EBIT margin vary (see dcf.scenarios.js). */
function ScenarioComparison({ scenarios, deltas }) {
    if (!scenarios) {
        return null;
    }

    return (
        <div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {['bear', 'base', 'bull'].map((key) => {
                    const scenario = scenarios[key];
                    const meta = SCENARIO_META[key];
                    const delta = deltas?.[key];

                    return (
                        <div key={key} className="rounded-lg border border-border bg-surface-sunken p-4">
                            <Badge tone={meta.tone}>{meta.label}</Badge>

                            {scenario?.isValid === false ? (
                                <p className="mt-3 text-sm text-ink-muted">Could not be calculated with these assumptions.</p>
                            ) : (
                                <>
                                    <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
                                        {formatPrice(scenario?.intrinsicValuePerShare)}
                                    </p>
                                    <p className="text-xs text-ink-muted">Intrinsic Value / Share</p>
                                    <p className="mt-2 text-sm font-medium text-ink-secondary">
                                        Valuation Gap: {formatGap(scenario?.upsideDownsidePercent)}
                                    </p>
                                </>
                            )}

                            {delta && (
                                <p className="mt-3 border-t border-border pt-3 text-xs text-ink-muted">
                                    Revenue Growth {formatDeltaPP(delta.revenueGrowth)}, EBIT Margin{' '}
                                    {formatDeltaPP(delta.ebitMargin)} vs. Base
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="mt-3 text-xs text-ink-muted">
                Bear and Bull only adjust Revenue Growth and EBIT Margin — WACC, terminal growth, tax rate, and capital
                structure stay identical to the Base Case you entered above.
            </p>
        </div>
    );
}

export default ScenarioComparison;
