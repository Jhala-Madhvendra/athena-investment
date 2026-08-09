import { useCallback, useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import Card from './ui/Card';
import Skeleton from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';
import DCFAssumptionsForm from './valuation/DCFAssumptionsForm';
import HistoricalFCFFTable from './valuation/HistoricalFCFFTable';
import CapitalStructureSummary from './valuation/CapitalStructureSummary';
import FCFFForecastTable from './valuation/FCFFForecastTable';
import WACCBreakdown from './valuation/WACCBreakdown';
import DCFSummary from './valuation/DCFSummary';
import MarketPriceComparison from './valuation/MarketPriceComparison';
import ScenarioComparison from './valuation/ScenarioComparison';
import SensitivityTable from './valuation/SensitivityTable';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const fetchJson = async (url, options, signal) => {
  const response = await fetch(url, { ...options, signal });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed.');
    error.errors = data.errors;
    throw error;
  }

  return data;
};

const REQUIRED_FIELDS = [
  'forecastYears',
  'revenueGrowth',
  'ebitMargin',
  'taxRate',
  'depreciationPercentRevenue',
  'capexPercentRevenue',
  'workingCapitalPercentRevenue',
  'terminalGrowthRate',
  'riskFreeRate',
  'beta',
  'equityRiskPremium',
  'preTaxCostOfDebt',
];

const FIELD_LABELS = {
  forecastYears: 'Forecast Years',
  revenueGrowth: 'Revenue Growth',
  ebitMargin: 'EBIT Margin',
  taxRate: 'Tax Rate',
  depreciationPercentRevenue: 'D&A % of Revenue',
  capexPercentRevenue: 'CapEx % of Revenue',
  workingCapitalPercentRevenue: 'Working Capital % of Revenue',
  terminalGrowthRate: 'Terminal Growth Rate',
  riskFreeRate: 'Risk-Free Rate',
  beta: 'Beta',
  equityRiskPremium: 'Equity Risk Premium',
  preTaxCostOfDebt: 'Pre-Tax Cost of Debt',
};

/**
 * DCF Valuation tab. Loads labeled starting assumptions from
 * GET /dcf/defaults, lets the user edit them, then POSTs to /dcf and
 * renders the full calculation waterfall - never just a final number (see
 * "Calculation Transparency" in the Sprint 6 brief).
 */
function Valuation() {
  const { ticker } = useParams();
  const { currency } = useOutletContext();

  const [defaults, setDefaults] = useState(null);
  const [defaultsLoading, setDefaultsLoading] = useState(true);
  const [defaultsError, setDefaultsError] = useState('');

  const [values, setValues] = useState({});
  const [formErrors, setFormErrors] = useState([]);

  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultErrors, setResultErrors] = useState([]);

  const [scenarios, setScenarios] = useState(null);
  const [scenariosError, setScenariosError] = useState('');

  const [sensitivity, setSensitivity] = useState(null);
  const [sensitivityError, setSensitivityError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const loadDefaults = async () => {
      setDefaultsLoading(true);
      setDefaultsError('');
      setResult(null);
      setResultErrors([]);
      setScenarios(null);
      setScenariosError('');
      setSensitivity(null);
      setSensitivityError('');

      try {
        const data = await fetchJson(
          `${apiBaseUrl}/api/valuation/${encodeURIComponent(ticker)}/dcf/defaults`,
          undefined,
          controller.signal
        );
        setDefaults(data);
        setValues({
          forecastYears: data.suggestedAssumptions.forecastYears.value,
          revenueGrowth: data.suggestedAssumptions.revenueGrowth.value,
          ebitMargin: data.suggestedAssumptions.ebitMargin.value,
          taxRate: data.suggestedAssumptions.taxRate.value,
          depreciationPercentRevenue: data.suggestedAssumptions.depreciationPercentRevenue.value,
          capexPercentRevenue: data.suggestedAssumptions.capexPercentRevenue.value,
          workingCapitalPercentRevenue: data.suggestedAssumptions.workingCapitalPercentRevenue.value,
          terminalGrowthRate: data.suggestedAssumptions.terminalGrowthRate.value,
          riskFreeRate: data.waccInputs.riskFreeRate.value,
          beta: data.waccInputs.beta.value,
          equityRiskPremium: data.waccInputs.equityRiskPremium.value,
          preTaxCostOfDebt: data.waccInputs.preTaxCostOfDebt.value,
        });
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setDefaultsError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setDefaultsLoading(false);
        }
      }
    };

    loadDefaults();
    return () => controller.abort();
  }, [ticker]);

  const handleFieldChange = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async () => {
    const missing = REQUIRED_FIELDS.filter(
      (field) => values[field] === null || values[field] === undefined || Number.isNaN(values[field])
    );

    if (missing.length > 0) {
      setFormErrors(missing.map((field) => `${FIELD_LABELS[field]} is required.`));
      return;
    }

    setFormErrors([]);
    setSubmitting(true);
    setResultErrors([]);
    setScenarios(null);
    setScenariosError('');
    setSensitivity(null);
    setSensitivityError('');

    const postJson = (path) =>
      fetchJson(`${apiBaseUrl}/api/valuation/${encodeURIComponent(ticker)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

    // Three independent calculations off the same assumptions - one section
    // failing (e.g. an edge-case sensitivity combination) shouldn't block the
    // other two from rendering.
    const [dcfOutcome, scenariosOutcome, sensitivityOutcome] = await Promise.allSettled([
      postJson('dcf'),
      postJson('dcf/scenarios'),
      postJson('dcf/sensitivity'),
    ]);

    if (dcfOutcome.status === 'fulfilled') {
      setResult(dcfOutcome.value);
    } else {
      setResult(null);
      const err = dcfOutcome.reason;
      setResultErrors(err.errors && err.errors.length ? err.errors : [err.message]);
    }

    if (scenariosOutcome.status === 'fulfilled') {
      setScenarios(scenariosOutcome.value);
    } else {
      setScenariosError(scenariosOutcome.reason.message || 'Scenario analysis failed.');
    }

    if (sensitivityOutcome.status === 'fulfilled') {
      setSensitivity(sensitivityOutcome.value);
    } else {
      setSensitivityError(sensitivityOutcome.reason.message || 'Sensitivity analysis failed.');
    }

    setSubmitting(false);
  };

  if (defaultsLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton variant="card" count={1} />
        <Skeleton variant="card" count={1} />
      </div>
    );
  }

  if (defaultsError) {
    return (
      <ErrorState
        title="Couldn't load valuation data"
        message={`${defaultsError} Import financial statements for ${ticker?.toUpperCase()} before running a DCF valuation.`}
      />
    );
  }

  if (!defaults) {
    return (
      <EmptyState
        icon={Calculator}
        title="No valuation data available"
        message={`No financial data is available for ${ticker?.toUpperCase()} yet.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">DCF Valuation</h2>
        <p className="mt-1 text-sm text-ink-muted">
          A Free-Cash-Flow-to-Firm (FCFF) discounted cash flow model for {ticker?.toUpperCase()}, built from
          Athena&apos;s stored financials and the assumptions you set below.
        </p>
      </div>

      <Card
        title="Historical Financials"
        eyebrow={defaults.latestFiscalYear ? `Through FY ${defaults.latestFiscalYear}` : undefined}
      >
        <div className="space-y-5">
          <HistoricalFCFFTable historicalFCFF={defaults.historicalFCFF} />
          <div className="border-t border-border pt-5">
            <h4 className="text-sm font-semibold text-ink">Capital Structure (Latest Reported Year)</h4>
            <div className="mt-3">
              <CapitalStructureSummary capitalStructure={defaults.capitalStructure} />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Forecast Assumptions">
        <DCFAssumptionsForm
          defaults={defaults}
          values={values}
          onFieldChange={handleFieldChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          formErrors={formErrors}
        />
      </Card>

      {resultErrors.length > 0 && (
        <Card title="Calculation Errors">
          <ul className="list-disc space-y-1 pl-5 text-sm text-critical">
            {resultErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </Card>
      )}

      {result && (
        <>
          <Card title="WACC">
            <WACCBreakdown waccBreakdown={result.waccBreakdown} />
          </Card>

          <Card title="FCFF Forecast" padded={false}>
            <div className="p-5">
              <FCFFForecastTable forecastDetail={result.forecastDetail} />
            </div>
          </Card>

          <Card title="DCF Calculation">
            <DCFSummary result={result} />
          </Card>

          <Card title="Market Price Comparison">
            <MarketPriceComparison
              currentMarketPrice={result.currentMarketPrice}
              intrinsicValuePerShare={result.intrinsicValuePerShare}
              upsideDownsidePercent={result.upsideDownsidePercent}
              currency={currency}
              disclaimer={result.disclaimer}
            />
          </Card>
        </>
      )}

      {(scenarios || scenariosError) && (
        <Card title="Bull / Base / Bear Scenarios">
          {scenariosError ? (
            <p className="text-sm text-ink-muted">{scenariosError}</p>
          ) : (
            <ScenarioComparison scenarios={scenarios.scenarios} deltas={scenarios.deltas} />
          )}
        </Card>
      )}

      {(sensitivity || sensitivityError) && (
        <Card title="Sensitivity Analysis">
          {sensitivityError ? (
            <p className="text-sm text-ink-muted">{sensitivityError}</p>
          ) : (
            <SensitivityTable
              matrix={sensitivity.matrix}
              baseWacc={sensitivity.baseWacc}
              baseTerminalGrowthRate={sensitivity.baseTerminalGrowthRate}
            />
          )}
        </Card>
      )}
    </div>
  );
}

export default Valuation;
