import { formatValue } from '../../lib/statementTabs';

const formatFactor = (value) => (typeof value === 'number' ? value.toFixed(3) : '—');

const ROWS = [
  ['Revenue', (d) => formatValue(d.revenue)],
  ['EBIT', (d) => formatValue(d.ebit)],
  ['NOPAT', (d) => formatValue(d.nopat)],
  ['+ D&A', (d) => formatValue(d.depreciationAndAmortization)],
  ['− CapEx', (d) => formatValue(d.capitalExpenditure)],
  ['− Change in NWC', (d) => formatValue(d.changeInNWC)],
  ['FCFF', (d) => formatValue(d.fcff)],
  ['Discount Factor', (d) => formatFactor(d.discountFactor)],
  ['PV of FCFF', (d) => formatValue(d.presentValue)],
];

/**
 * Steps 2 + 7 (Forecast FCFF + Discounting): the full per-year waterfall,
 * not just a final FCFF number - this is the "Calculation Transparency"
 * requirement made concrete.
 */
function FCFFForecastTable({ forecastDetail }) {
  if (!forecastDetail || forecastDetail.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-sunken">
            <th scope="col" className="sticky left-0 bg-surface-sunken px-4 py-2.5 text-left font-semibold text-ink-secondary">
              Forecast Waterfall
            </th>
            {forecastDetail.map((entry) => (
              <th
                key={entry.year}
                scope="col"
                className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink-secondary"
              >
                Year {entry.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, getValue]) => (
            <tr
              key={label}
              className={`border-b border-border last:border-0 ${label === 'FCFF' ? 'bg-surface-sunken/60' : ''}`}
            >
              <th
                scope="row"
                className={`sticky left-0 px-4 py-2.5 text-left font-medium text-ink-secondary ${
                  label === 'FCFF' ? 'bg-surface-sunken/60 font-semibold text-ink' : 'bg-surface-raised'
                }`}
              >
                {label}
              </th>
              {forecastDetail.map((entry) => (
                <td
                  key={entry.year}
                  className={`px-4 py-2.5 text-right tabular-nums text-ink ${label === 'FCFF' ? 'font-semibold' : ''}`}
                >
                  {getValue(entry)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FCFFForecastTable;
