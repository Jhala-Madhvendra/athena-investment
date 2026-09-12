import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles, RefreshCw } from 'lucide-react';
import Card from './ui/Card';
import Skeleton from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import SectionHeader from './ui/SectionHeader';
import ReportSection from './ai/ReportSection';
import ReportBulletList from './ai/ReportBulletList';
import { fetchJson } from '../lib/api';

/** "4.5" (a percent, as a human would type it) -> 0.045 (the decimal the API expects). Blank/invalid input is omitted, letting the backend fall back to its own illustrative estimate. */
const parseCostOfDebtPercent = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const percent = Number(trimmed);
  return Number.isFinite(percent) ? percent / 100 : undefined;
};

const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Data unavailable';

const formatFiscalPeriod = (period) =>
  period && period.startYear && period.endYear ? `FY${period.startYear}–FY${period.endYear}` : 'Data unavailable';

const NARRATIVE_SECTIONS = [
  ['executiveSummary', 'Executive Summary'],
  ['companyOverview', 'Company Overview'],
  ['businessPerformance', 'Business Performance'],
  ['financialHealth', 'Financial Health'],
  ['marketPerformance', 'Market Performance'],
  ['valuation', 'Valuation'],
  ['recentDevelopments', 'Recent Developments'],
  ['conclusion', 'Analytical Conclusion'],
];

/**
 * AI Equity Research Analyst page. Never auto-generates on load - only a
 * GET (persisted-report-or-nothing) check runs on mount; the LLM is only
 * ever called from an explicit Generate/Regenerate click (see
 * research/product/AIResearchAnalystProductDesign.md for why). This is a
 * research report layout, not a chat UI - narrative sections are labeled
 * AI Interpretation with evidence chips back to Athena's own metrics;
 * strengths/risks/considerations are visually distinct list sections.
 */
function AIResearch() {
  const { ticker } = useParams();

  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState('');
  const [report, setReport] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [costOfDebtInput, setCostOfDebtInput] = useState('');
  const [usage, setUsage] = useState(null);

  /** Shared across AI Research Reports and Earnings AI Summaries - see backend/ai/aiQuota.service.js. Best-effort: a failed usage lookup just hides the badge, it never blocks Generate/Regenerate. */
  const loadUsage = async () => {
    try {
      const data = await fetchJson('/api/ai/usage');
      setUsage(data);
    } catch {
      // Non-critical - the badge just doesn't render.
    }
  };

  useEffect(() => {
    loadUsage();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const checkForExistingReport = async () => {
      setInitialLoading(true);
      setInitialError('');
      setReport(null);

      try {
        const data = await fetchJson(`/api/ai/${encodeURIComponent(ticker)}/research-report`, undefined, controller.signal);
        setReport(data);
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        if (requestError.status !== 404) {
          setInitialError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setInitialLoading(false);
        }
      }
    };

    checkForExistingReport();
    return () => controller.abort();
  }, [ticker]);

  const handleGenerate = async (regenerate) => {
    setGenerating(true);
    setGenerateError('');

    const body = { regenerate };
    const preTaxCostOfDebt = parseCostOfDebtPercent(costOfDebtInput);
    if (preTaxCostOfDebt !== undefined) {
      body.preTaxCostOfDebt = preTaxCostOfDebt;
    }

    try {
      const data = await fetchJson(`/api/ai/${encodeURIComponent(ticker)}/research-report`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setReport(data);
      await loadUsage();
    } catch (requestError) {
      setGenerateError(requestError.errors?.join(' ') || requestError.message);
    } finally {
      setGenerating(false);
    }
  };

  const costOfDebtField = (
    <details className="text-left">
      <summary className="cursor-pointer text-xs font-medium text-ink-muted hover:text-ink-secondary">
        Advanced: DCF cost of debt (optional)
      </summary>
      <div className="mt-2 space-y-1">
        <label htmlFor="cost-of-debt" className="block text-xs text-ink-muted">
          Pre-tax cost of debt, % - Athena has no interest-expense data to derive this automatically. Leave blank to
          use an illustrative estimate (risk-free rate + a typical credit spread).
        </label>
        <input
          id="cost-of-debt"
          type="number"
          step="0.1"
          placeholder="e.g. 4.5"
          value={costOfDebtInput}
          onChange={(event) => setCostOfDebtInput(event.target.value)}
          className="w-32 rounded-md border border-border bg-surface-raised px-2 py-1 text-sm text-ink focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 focus:outline-none"
        />
      </div>
    </details>
  );

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="AI Research Analyst" description={`Athena-grounded equity research for ${ticker?.toUpperCase()}`} />
        <Skeleton variant="card" count={1} />
      </div>
    );
  }

  if (initialError) {
    return (
      <div className="space-y-6">
        <SectionHeader title="AI Research Analyst" description={`Athena-grounded equity research for ${ticker?.toUpperCase()}`} />
        <ErrorState title="Couldn't check for an existing report" message={initialError} />
      </div>
    );
  }

  const usageBadge = usage && (
    <p className="text-xs text-ink-muted">
      {usage.used} of {usage.limit} AI reports used this month
      {usage.remaining === 0 ? ' - limit reached, resets next month.' : '.'}
    </p>
  );

  if (!report) {
    return (
      <div className="space-y-6">
        <SectionHeader title="AI Research Analyst" description={`Athena-grounded equity research for ${ticker?.toUpperCase()}`} />
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">No research report yet for {ticker?.toUpperCase()}</p>
              <p className="mt-1 max-w-md text-sm text-ink-muted">
                Athena will interpret its existing financial analysis, valuation, and market data into a structured
                report. The AI never calculates figures itself and never issues buy/sell advice.
              </p>
            </div>
            {costOfDebtField}
            <button
              type="button"
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {generating ? 'Generating…' : 'Generate Research Report'}
            </button>
            {usageBadge}
            {generateError && <p className="max-w-md text-sm text-critical">{generateError}</p>}
          </div>
        </Card>
      </div>
    );
  }

  const sections = report.report;
  const evidence = report.sectionEvidence || {};
  const freshness = report.dataFreshness || {};

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI Research Analyst"
        description={`Athena-grounded equity research for ${ticker?.toUpperCase()}`}
        action={
          <button
            type="button"
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} aria-hidden="true" />
            {generating ? 'Regenerating…' : 'Regenerate'}
          </button>
        }
      />

      {costOfDebtField}
      {usageBadge}
      {generateError && (
        <p className="rounded-lg border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">{generateError}</p>
      )}

      <Card title="Report Data Freshness">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-ink-muted">Report Generated At</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatDateTime(report.generatedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Market Data As Of</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatDateTime(freshness.marketDataAsOf)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Financial Data Period</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatFiscalPeriod(freshness.financialDataPeriod)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Valuation Calculation Date</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatDateTime(freshness.dcfCalculatedAt)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <div className="space-y-6">
          {NARRATIVE_SECTIONS.filter(([key]) => sections[key]).map(([key, title]) => (
            <ReportSection key={key} title={title} text={sections[key]} evidence={evidence[key]} />
          ))}
        </div>
      </Card>

      <Card>
        <div className="space-y-6">
          <ReportBulletList title="Key Strengths" items={sections.strengths} tone="good" />
          <ReportBulletList title="Key Risks" items={sections.risks} tone="critical" />
          <ReportBulletList title="Important Considerations" items={sections.considerations} tone="warning" />
          <ReportBulletList title="Data Gaps" items={sections.dataGaps} tone="neutral" />
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        This report is Athena&apos;s AI interpreting figures its deterministic engines already calculated. It is not
        financial advice and does not constitute a recommendation to buy, sell, or hold any security.
      </p>
    </div>
  );
}

export default AIResearch;
