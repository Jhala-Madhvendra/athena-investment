const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;
const formatPrice = (value) => (typeof value === 'number' ? value.toFixed(2) : '—');

const BRAND_RGB = '42, 120, 214'; // --color-brand-500, matches the WACC/Enterprise/Equity headline numbers elsewhere on this page

/**
 * Intrinsic Value / Share is a magnitude, not a polarity - it isn't "good"
 * or "bad" in isolation (DCF makes no Buy/Sell claim), so this uses a
 * single-hue sequential wash (light -> darker brand blue) rather than a
 * red/green diverging scale, which would visually imply a judgment the
 * product deliberately does not make. Cell text stays dark ink throughout;
 * only the wash opacity varies, keeping text/background contrast high at
 * every step.
 */
const cellBackground = (value, min, max) => {
    if (typeof value !== 'number' || min === max) {
        return undefined;
    }
    const normalized = (value - min) / (max - min);
    const alpha = 0.08 + normalized * 0.34;
    return `rgba(${BRAND_RGB}, ${alpha.toFixed(3)})`;
};

/** Step 13 (Sensitivity Analysis): WACC (rows) x Terminal Growth Rate (columns) -> Intrinsic Value / Share. */
function SensitivityTable({ matrix, baseWacc, baseTerminalGrowthRate }) {
    if (!matrix || !matrix.rows || matrix.rows.length === 0) {
        return null;
    }

    const validValues = matrix.rows
        .flatMap((row) => row.cells)
        .filter((cell) => cell.isValid)
        .map((cell) => cell.intrinsicValuePerShare);
    const min = validValues.length ? Math.min(...validValues) : 0;
    const max = validValues.length ? Math.max(...validValues) : 0;

    // Matrix values are rounded to 4 decimals (buildRangeAroundCenter), but
    // baseWacc/baseTerminalGrowthRate come straight from the unrounded WACC
    // calculation - round both sides the same way before comparing, or the
    // center cell (which should always match exactly) never does.
    const isBaseCell = (wacc, terminalGrowthRate) =>
        typeof baseWacc === 'number' &&
        typeof baseTerminalGrowthRate === 'number' &&
        wacc.toFixed(4) === baseWacc.toFixed(4) &&
        terminalGrowthRate.toFixed(4) === baseTerminalGrowthRate.toFixed(4);

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr>
                            <th scope="col" className="border border-border bg-surface-sunken px-3 py-2 text-xs font-semibold text-ink-secondary">
                                WACC \ Terminal Growth
                            </th>
                            {matrix.terminalGrowthValues.map((g) => (
                                <th
                                    key={g}
                                    scope="col"
                                    className="border border-border bg-surface-sunken px-3 py-2 text-right text-xs font-semibold tabular-nums text-ink-secondary"
                                >
                                    {formatPercent(g)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.rows.map((row) => (
                            <tr key={row.wacc}>
                                <th
                                    scope="row"
                                    className="border border-border bg-surface-sunken px-3 py-2 text-right text-xs font-semibold tabular-nums text-ink-secondary"
                                >
                                    {formatPercent(row.wacc)}
                                </th>
                                {row.cells.map((cell) => {
                                    const base = isBaseCell(cell.wacc, cell.terminalGrowthRate);
                                    return (
                                        <td
                                            key={`${cell.wacc}-${cell.terminalGrowthRate}`}
                                            title={
                                                cell.isValid
                                                    ? undefined
                                                    : 'Terminal growth must be below WACC - not a valid combination.'
                                            }
                                            className={`border px-3 py-2 text-right tabular-nums ${
                                                base ? 'border-2 border-brand-600 font-bold text-ink' : 'border-border text-ink'
                                            } ${!cell.isValid ? 'bg-surface-sunken text-ink-muted' : ''}`}
                                            style={cell.isValid ? { backgroundColor: cellBackground(cell.intrinsicValuePerShare, min, max) } : undefined}
                                        >
                                            {cell.isValid ? formatPrice(cell.intrinsicValuePerShare) : '—'}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
                Darker shading = higher Intrinsic Value / Share. The boxed cell is your Base Case. Blank cells (—) are
                combinations where Terminal Growth would equal or exceed WACC, which has no valid present value.
            </p>
        </div>
    );
}

export default SensitivityTable;
