import AssumptionField from './AssumptionField';

const FORECAST_FIELDS = [
  { key: 'revenueGrowth', label: 'Revenue Growth' },
  { key: 'ebitMargin', label: 'EBIT Margin' },
  { key: 'taxRate', label: 'Tax Rate' },
  { key: 'depreciationPercentRevenue', label: 'D&A % of Revenue' },
  { key: 'capexPercentRevenue', label: 'CapEx % of Revenue' },
  { key: 'workingCapitalPercentRevenue', label: 'Working Capital % of Revenue' },
  { key: 'terminalGrowthRate', label: 'Terminal Growth Rate' },
];

const WACC_FIELDS = [
  { key: 'riskFreeRate', label: 'Risk-Free Rate' },
  { key: 'beta', label: 'Beta', isPercent: false, unit: '×', step: 0.05 },
  { key: 'equityRiskPremium', label: 'Equity Risk Premium' },
  { key: 'preTaxCostOfDebt', label: 'Pre-Tax Cost of Debt' },
];

/**
 * All assumptions are applied uniformly across every forecast year in this
 * first version (the engine and API already support per-year arrays; a
 * per-year override UI is a natural follow-up, not built here to keep the
 * form usable in one pass).
 */
function DCFAssumptionsForm({ defaults, values, onFieldChange, onSubmit, submitting, formErrors }) {
  const suggested = defaults?.suggestedAssumptions || {};
  const waccInputs = defaults?.waccInputs || {};

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-6"
    >
      <div className="max-w-[160px]">
        <AssumptionField
          id="forecastYears"
          label="Forecast Years"
          decimalValue={values.forecastYears}
          onChange={(v) => onFieldChange('forecastYears', v === null ? null : Math.round(v))}
          isPercent={false}
          unit="yrs"
          min={1}
          max={15}
          step={1}
          source={suggested.forecastYears?.source}
          note={suggested.forecastYears?.note}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink">FCFF Forecast Assumptions</h4>
        <p className="mt-1 text-xs text-ink-muted">
          Applied to every forecast year. Pre-filled values are historical/derived starting points, not
          predictions — review and adjust for your own view.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FORECAST_FIELDS.map(({ key, label, ...rest }) => (
            <AssumptionField
              key={key}
              id={key}
              label={label}
              decimalValue={values[key]}
              onChange={(v) => onFieldChange(key, v)}
              source={suggested[key]?.source}
              note={suggested[key]?.note}
              {...rest}
            />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink">WACC Inputs (CAPM + Cost of Debt)</h4>
        <p className="mt-1 text-xs text-ink-muted">
          Athena computes WACC from these inputs plus the company&apos;s capital structure — WACC itself is never
          entered directly.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WACC_FIELDS.map(({ key, label, ...rest }) => (
            <AssumptionField
              key={key}
              id={key}
              label={label}
              decimalValue={values[key]}
              onChange={(v) => onFieldChange(key, v)}
              source={waccInputs[key]?.source}
              note={waccInputs[key]?.note}
              {...rest}
            />
          ))}
        </div>
      </div>

      {formErrors && formErrors.length > 0 && (
        <div className="rounded-lg border border-critical/20 bg-critical/5 p-4">
          <p className="text-sm font-semibold text-critical">Fix the following before calculating:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">
            {formErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Calculating…' : 'Calculate DCF Valuation'}
      </button>
    </form>
  );
}

export default DCFAssumptionsForm;
