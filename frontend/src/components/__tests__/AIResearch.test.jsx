import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import AIResearch from '../AIResearch';
import { renderWithShellContext } from '../../test/renderWithRouter';
import { mockAiFetch, errorResponse } from '../../test/fetchMock';
import { aiReportFixture } from '../../test/aiResearchFixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AIResearch - initial load', () => {
  it('never calls the LLM on mount - only a GET fires', async () => {
    mockAiFetch({ get: errorResponse(404, 'No report yet.') });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText(/No research report yet/);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.mock.calls[0][1]?.method ?? 'GET').toBe('GET');
  });

  it('shows the idle Generate CTA when no report has been generated yet (404)', async () => {
    mockAiFetch({ get: errorResponse(404, 'No report yet.') });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    expect(await screen.findByText('No research report yet for AAPL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Research Report/i })).toBeInTheDocument();
  });

  it('shows an error state when the initial check fails for a reason other than 404', async () => {
    mockAiFetch({ get: errorResponse(502, 'Upstream failure.') });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    expect(await screen.findByText("Couldn't check for an existing report")).toBeInTheDocument();
    expect(screen.getByText('Upstream failure.')).toBeInTheDocument();
  });

  it('renders the full report immediately when one is already persisted', async () => {
    mockAiFetch({ get: aiReportFixture });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    expect(await screen.findByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText(aiReportFixture.report.executiveSummary)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
    // No second (POST) call happened just from rendering the persisted report.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('AIResearch - report layout', () => {
  it('renders freshness metadata and all report sections distinctly', async () => {
    mockAiFetch({ get: aiReportFixture });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText('Executive Summary');

    expect(screen.getByText('Report Data Freshness')).toBeInTheDocument();
    expect(screen.getByText('FY2020–FY2024')).toBeInTheDocument();

    expect(screen.getByText('Company Overview')).toBeInTheDocument();
    expect(screen.getByText('Business Performance')).toBeInTheDocument();
    expect(screen.getByText('Financial Health')).toBeInTheDocument();
    expect(screen.getByText('Market Performance')).toBeInTheDocument();
    expect(screen.getByText('Valuation')).toBeInTheDocument();
    expect(screen.getByText('Analytical Conclusion')).toBeInTheDocument();

    expect(screen.getByText('Key Strengths')).toBeInTheDocument();
    expect(screen.getByText('Consistent revenue growth')).toBeInTheDocument();
    expect(screen.getByText('Key Risks')).toBeInTheDocument();
    expect(screen.getByText('Elevated valuation multiple')).toBeInTheDocument();
    expect(screen.getByText('Important Considerations')).toBeInTheDocument();
    expect(screen.getByText('Data Gaps')).toBeInTheDocument();

    // "AI Interpretation" badge appears once per narrative section (7 sections).
    expect(screen.getAllByText('AI Interpretation')).toHaveLength(7);
  });

  it('renders evidence chips only for sections the backend actually cited', async () => {
    mockAiFetch({ get: aiReportFixture });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText('Executive Summary');

    const execSummaryHeading = screen.getByText('Executive Summary');
    const execSummarySection = execSummaryHeading.closest('div').parentElement;
    expect(within(execSummarySection).getByText('Overall')).toBeInTheDocument();
    expect(within(execSummarySection).getByText('Intrinsic Value Per Share')).toBeInTheDocument();

    // Company Overview has no sectionEvidence entry in the fixture - no "Based on:" chip row.
    const overviewHeading = screen.getByText('Company Overview');
    const overviewSection = overviewHeading.closest('div').parentElement;
    expect(within(overviewSection).queryByText('Based on:')).not.toBeInTheDocument();
  });

  it('never renders a Buy/Sell/Strong Buy/Strong Sell recommendation anywhere on the page', async () => {
    mockAiFetch({ get: aiReportFixture });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText('Executive Summary');

    // Athena's own footer disclaimer deliberately uses "buy, sell, or hold"
    // to disclaim advice, not to give it - excluded the same way
    // Valuation.test.jsx strips "Yield" before running this check.
    const bodyText = document.body.textContent.replace(
      /does not constitute a recommendation to buy, sell, or hold any security\.?/i,
      ''
    );
    expect(bodyText).not.toMatch(/\bbuy\b|\bsell\b|strong buy|strong sell/i);
  });
});

describe('AIResearch - generate flow', () => {
  it('shows a Generating… state while the request is in flight', async () => {
    // A never-resolving generate promise (matching mockValuationFetch({})'s
    // "hangs" convention) so the transient state can be asserted reliably,
    // instead of racing a fast-resolving mock.
    mockAiFetch({ get: errorResponse(404, 'No report yet.'), generate: undefined });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText('No research report yet for AAPL');
    fireEvent.click(screen.getByRole('button', { name: /Generate Research Report/i }));

    expect(await screen.findByText('Generating…')).toBeInTheDocument();
  });

  it('generates a report from the idle state and renders it on success', async () => {
    mockAiFetch({ get: errorResponse(404, 'No report yet.'), generate: aiReportFixture });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText('No research report yet for AAPL');
    fireEvent.click(screen.getByRole('button', { name: /Generate Research Report/i }));

    expect(await screen.findByText('Executive Summary')).toBeInTheDocument();

    const [, postOptions] = globalThis.fetch.mock.calls[1];
    expect(postOptions.method).toBe('POST');
    expect(JSON.parse(postOptions.body)).toEqual({ regenerate: false });
  });

  it('shows an inline error and keeps the idle CTA when generation fails', async () => {
    mockAiFetch({
      get: errorResponse(404, 'No report yet.'),
      generate: errorResponse(502, 'ANTHROPIC_API_KEY is not configured on the server.'),
    });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText('No research report yet for AAPL');
    fireEvent.click(screen.getByRole('button', { name: /Generate Research Report/i }));

    expect(await screen.findByText('ANTHROPIC_API_KEY is not configured on the server.')).toBeInTheDocument();
    // Still idle, not crashed - the CTA is still there to retry.
    expect(screen.getByRole('button', { name: /Generate Research Report/i })).toBeInTheDocument();
  });

  it('sends the optional preTaxCostOfDebt as a decimal when the advanced field is filled in', async () => {
    mockAiFetch({ get: errorResponse(404, 'No report yet.'), generate: aiReportFixture });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText('No research report yet for AAPL');
    fireEvent.click(screen.getByText('Advanced: DCF cost of debt (optional)'));
    fireEvent.change(screen.getByLabelText(/Pre-tax cost of debt/i), { target: { value: '4.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Research Report/i }));

    await screen.findByText('Executive Summary');
    const [, postOptions] = globalThis.fetch.mock.calls[1];
    expect(JSON.parse(postOptions.body)).toEqual({ regenerate: false, preTaxCostOfDebt: 0.045 });
  });

  it('regenerates from the ready state, sending regenerate: true, and replaces the displayed report', async () => {
    const updatedReport = {
      ...aiReportFixture,
      report: { ...aiReportFixture.report, executiveSummary: 'An updated executive summary after regeneration.' },
    };
    mockAiFetch({ get: aiReportFixture, generate: updatedReport });
    renderWithShellContext(<AIResearch />, { path: 'ai-research' });

    await screen.findByText('Executive Summary');
    fireEvent.click(screen.getByRole('button', { name: /Regenerate/i }));

    await waitFor(() => expect(screen.getByText('An updated executive summary after regeneration.')).toBeInTheDocument());
    const [, postOptions] = globalThis.fetch.mock.calls[1];
    expect(JSON.parse(postOptions.body)).toEqual({ regenerate: true });
  });
});
